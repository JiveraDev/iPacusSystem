<?php

/**
 * Small streaming ZIP writer used by System Backup.
 *
 * The production PHP build is not guaranteed to include ext-zip. This writer
 * creates standards-compliant ZIP files without loading uploaded media into
 * memory. Entries use data descriptors, UTF-8 names, and raw DEFLATE when the
 * zlib extension is available.
 */
final class IpawcusStreamingZipWriter
{
    /** @var resource */
    private $handle;
    private array $entries = [];
    private bool $closed = false;

    public function __construct(private readonly string $path)
    {
        $handle = fopen($path, 'w+b');
        if ($handle === false) {
            throw new RuntimeException('The backup archive could not be created.');
        }
        $this->handle = $handle;
    }

    public function addString(string $archivePath, string $contents, ?int $modifiedAt = null): void
    {
        $stream = fopen('php://temp', 'w+b');
        if ($stream === false) {
            throw new RuntimeException('Temporary backup memory could not be opened.');
        }

        try {
            if ($contents !== '' && fwrite($stream, $contents) === false) {
                throw new RuntimeException('Temporary backup content could not be written.');
            }
            rewind($stream);
            $this->addStream($archivePath, $stream, $modifiedAt ?? time());
        } finally {
            fclose($stream);
        }
    }

    public function addFile(string $archivePath, string $sourcePath): void
    {
        if (!is_file($sourcePath) || !is_readable($sourcePath)) {
            throw new RuntimeException('A backup source file could not be read.');
        }

        $stream = fopen($sourcePath, 'rb');
        if ($stream === false) {
            throw new RuntimeException('A backup source file could not be opened.');
        }

        try {
            $this->addStream($archivePath, $stream, (int)(filemtime($sourcePath) ?: time()));
        } finally {
            fclose($stream);
        }
    }

    public function close(): void
    {
        if ($this->closed) {
            return;
        }

        $centralDirectoryOffset = ftell($this->handle);
        if ($centralDirectoryOffset === false) {
            throw new RuntimeException('The backup archive position could not be read.');
        }

        foreach ($this->entries as $entry) {
            $name = $entry['name'];
            $this->write(pack(
                'VvvvvvvVVVvvvvvVV',
                0x02014b50,
                20,
                20,
                $entry['flags'],
                $entry['method'],
                $entry['time'],
                $entry['date'],
                $entry['crc'],
                $entry['compressedSize'],
                $entry['size'],
                strlen($name),
                0,
                0,
                0,
                0,
                0,
                $entry['offset']
            ));
            $this->write($name);
        }

        $centralDirectoryEnd = ftell($this->handle);
        if ($centralDirectoryEnd === false) {
            throw new RuntimeException('The backup archive position could not be read.');
        }
        $centralDirectorySize = $centralDirectoryEnd - $centralDirectoryOffset;
        if ($centralDirectoryEnd > 0xffffffff || $centralDirectorySize > 0xffffffff) {
            throw new RuntimeException('The backup archive is too large for the supported ZIP format.');
        }

        $entryCount = count($this->entries);
        if ($entryCount > 65535) {
            throw new RuntimeException('The backup contains too many files for this archive format.');
        }

        $this->write(pack(
            'VvvvvVVv',
            0x06054b50,
            0,
            0,
            $entryCount,
            $entryCount,
            $centralDirectorySize,
            $centralDirectoryOffset,
            0
        ));

        fflush($this->handle);
        fclose($this->handle);
        $this->closed = true;
    }

    public function __destruct()
    {
        if (!$this->closed && is_resource($this->handle)) {
            fclose($this->handle);
        }
    }

    /** @param resource $stream */
    private function addStream(string $archivePath, $stream, int $modifiedAt): void
    {
        if ($this->closed) {
            throw new LogicException('The backup archive is already closed.');
        }

        $name = $this->normalizeArchivePath($archivePath);
        [$dosTime, $dosDate] = $this->dosDateTime($modifiedAt);
        $offset = ftell($this->handle);
        if ($offset === false || $offset > 0xffffffff) {
            throw new RuntimeException('The backup archive is too large for the supported ZIP format.');
        }

        $flags = 0x0808;
        $method = function_exists('deflate_init') ? 8 : 0;
        $this->write(pack(
            'VvvvvvVVVvv',
            0x04034b50,
            20,
            $flags,
            $method,
            $dosTime,
            $dosDate,
            0,
            0,
            0,
            strlen($name),
            0
        ));
        $this->write($name);

        $crcContext = hash_init('crc32b');
        $size = 0;
        $compressedSize = 0;
        $deflateContext = $method === 8 ? deflate_init(ZLIB_ENCODING_RAW, ['level' => 6]) : null;
        if ($method === 8 && $deflateContext === false) {
            throw new RuntimeException('Backup compression could not be initialized.');
        }

        while (!feof($stream)) {
            $chunk = fread($stream, 1024 * 1024);
            if ($chunk === false) {
                throw new RuntimeException('A backup source could not be read completely.');
            }
            if ($chunk === '') {
                continue;
            }

            $size += strlen($chunk);
            if ($size > 0xffffffff) {
                throw new RuntimeException('A backup file is larger than the supported ZIP entry limit.');
            }
            hash_update($crcContext, $chunk);
            $output = $method === 8 ? deflate_add($deflateContext, $chunk, ZLIB_NO_FLUSH) : $chunk;
            if ($output === false) {
                throw new RuntimeException('Backup compression failed.');
            }
            $compressedSize += strlen($output);
            $this->write($output);
        }

        if ($method === 8) {
            $output = deflate_add($deflateContext, '', ZLIB_FINISH);
            if ($output === false) {
                throw new RuntimeException('Backup compression could not be finalized.');
            }
            $compressedSize += strlen($output);
            $this->write($output);
        }

        if ($compressedSize > 0xffffffff) {
            throw new RuntimeException('A compressed backup file is too large for the supported ZIP format.');
        }

        $crc = (int)hexdec(hash_final($crcContext));
        $this->write(pack('VVVV', 0x08074b50, $crc, $compressedSize, $size));
        $this->entries[] = [
            'name' => $name,
            'flags' => $flags,
            'method' => $method,
            'time' => $dosTime,
            'date' => $dosDate,
            'crc' => $crc,
            'compressedSize' => $compressedSize,
            'size' => $size,
            'offset' => $offset,
        ];
    }

    private function normalizeArchivePath(string $path): string
    {
        $path = ltrim(str_replace('\\', '/', trim($path)), '/');
        if ($path === '' || str_contains($path, '../') || str_contains($path, "\0")) {
            throw new InvalidArgumentException('Invalid path inside the backup archive.');
        }
        return $path;
    }

    private function dosDateTime(int $timestamp): array
    {
        $parts = getdate(max($timestamp, 315532800));
        $year = max(1980, min(2107, (int)$parts['year']));
        $time = ((int)$parts['hours'] << 11) | ((int)$parts['minutes'] << 5) | ((int)$parts['seconds'] >> 1);
        $date = (($year - 1980) << 9) | ((int)$parts['mon'] << 5) | (int)$parts['mday'];
        return [$time, $date];
    }

    private function write(string $bytes): void
    {
        $length = strlen($bytes);
        $offset = 0;
        while ($offset < $length) {
            $written = fwrite($this->handle, substr($bytes, $offset));
            if ($written === false || $written === 0) {
                throw new RuntimeException('The backup archive could not be written completely.');
            }
            $offset += $written;
        }
    }
}
