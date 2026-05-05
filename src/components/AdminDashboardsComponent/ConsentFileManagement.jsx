import { useState } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Upload, FileText, Trash2, Download, Eye, Search } from 'lucide-react';
    // import {
    //     AlertDialog,
    //     AlertDialogAction,
    //     AlertDialogCancel,
    //     AlertDialogContent,
    //     AlertDialogDescription,
    //     AlertDialogFooter,
    //     AlertDialogHeader,
    //     AlertDialogTitle,
    //     AlertDialogTrigger,
    // } from '../../ui/dialog'; // Assuming AlertDialog is in dialog or separate, but let's use dialog.jsx if alert-dialog is missing

export default function ConsentFilesManagement() {
    const [files, setFiles] = useState(mockFiles);
    const [isUploading, setIsUploading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const handleUpload = (event) => {
        const fileInput = event.target;
        const file = fileInput.files?.[0];
        if (file) {
            // Check if file is TXT
            if (!file.name.toLowerCase().endsWith('.txt')) {
                alert('Please upload only TXT files');
                fileInput.value = '';
                return;
            }

            setIsUploading(true);
            // Simulate file upload
            setTimeout(() => {
                const newFile = {
                    id: Date.now().toString(),
                    name: file.name.replace(/\.[^/.]+$/, ''), // Remove file extension
                    type: 'TXT',
                    size: formatFileSize(file.size),
                    uploadDate: new Date().toISOString().split('T')[0],
                    category: 'General'
                };

                setFiles([newFile, ...files]);
                setIsUploading(false);
                fileInput.value = '';
            }, 1000);
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i)) + ' ' + sizes[i];
    };

    const deleteFile = (id) => {
        setFiles(files.filter(file => file.id !== id));
    };

    const filteredFiles = files.filter(file =>
        file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getCategoryColor = (category) => {
        const colors = {
            'General Services': 'bg-blue-100 text-blue-800',
            'Special Services': 'bg-purple-100 text-purple-800',
            'Vaccinations': 'bg-green-100 text-green-800',
            'Boarding': 'bg-yellow-100 text-yellow-800',
            'Grooming': 'bg-pink-100 text-pink-800',
            'Emergency': 'bg-red-100 text-red-800',
            'General': 'bg-gray-100 text-gray-800'
        };
        return colors[category] || colors['General'];
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h2 className="font-['Arimo:Bold',sans-serif] font-bold text-[24px] text-[#101828] mb-2">
                    Consent Files Management
                </h2>
                <p className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#4a5565]">
                    Manage clinic consent forms and documents
                </p>
            </div>

            {/* Upload Section */}
            <div className="bg-white border border-[rgba(0,0,0,0.1)] rounded-[14px] p-6">
                <h3 className="font-['Arimo:Bold',sans-serif] font-bold text-[18px] text-[#101828] mb-4">
                    Upload New Consent File
                </h3>
                <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565] mb-4">
                    Only TXT files are accepted for consent forms
                </p>
                <div className="flex gap-4">
                    <Input
                        type="text"
                        placeholder="File name (e.g., Surgical Consent Form)"
                        className="flex-1"
                    />
                    <Input
                        type="file"
                        accept=".txt"
                        onChange={handleUpload}
                        className="flex-1"
                    />
                    <Button
                        disabled={isUploading}
                        className="bg-[#155dfc] hover:bg-[#1447e6]"
                    >
                        <Upload className="size-4 mr-2" />
                        {isUploading ? 'Uploading...' : 'Upload File'}
                    </Button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="mb-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#4a5565]" />
                    <Input
                        placeholder="Search consent files by name or category..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Statistics - Only Total Files */}
            <div className="bg-[#eff6ff] border border-[#bedbff] rounded-[14px] p-6 mb-6">
                <div className="text-center">
                    <p className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#4a5565] mb-2">
                        Total Files
                    </p>
                    <p className="font-['Arimo:Bold',sans-serif] text-[36px] text-[#155dfc]">
                        {files.length}
                    </p>
                </div>
            </div>

            {/* Files Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFiles.map((file) => (
                    <Card key={file.id} className="hover:shadow-lg transition-shadow">
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                                <div className="bg-[#dbeafe] rounded-lg p-3">
                                    <FileText className="size-6 text-[#155dfc]" />
                                </div>
                            </div>

                            <h4 className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828] mb-2 line-clamp-2">
                                {file.name}
                            </h4>

                            <div className="space-y-1 mb-4">
                                <div className="flex items-center justify-between">
                  <span className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">
                    Type:
                  </span>
                                    <span className="font-['Arimo:Bold',sans-serif] text-[12px] text-[#101828]">
                    {file.type}
                  </span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="flex-1">
                                    <Download className="size-4 mr-1" />
                                    Download
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => deleteFile(file.id)}>
                                    <Trash2 className="size-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {filteredFiles.length === 0 && (
                <div className="py-12 text-center">
                    <FileText className="size-12 text-[#99A1AF] mx-auto mb-4" />
                    <p className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-2">
                        No Consent Files Found
                    </p>
                    <p className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#4a5565]">
                        {searchQuery ? 'Try adjusting your search query' : 'Upload your first consent file to get started'}
                    </p>
                </div>
            )}
        </div>
    );
}

const mockFiles = [
    {
        id: '1',
        name: 'General Check-Up Service Consent',
        type: 'TXT',
        size: '12 KB',
        uploadDate: '2026-01-15',
        category: 'General Services'
    },
    {
        id: '2',
        name: 'Surgical Procedure Consent Form',
        type: 'TXT',
        size: '15 KB',
        uploadDate: '2026-01-20',
        category: 'Special Services'
    },
    {
        id: '3',
        name: 'Vaccination Consent',
        type: 'TXT',
        size: '8 KB',
        uploadDate: '2026-01-18',
        category: 'Vaccinations'
    },
    {
        id: '4',
        name: 'Pet Boarding Agreement',
        type: 'TXT',
        size: '18 KB',
        uploadDate: '2026-01-22',
        category: 'Boarding'
    },
    {
        id: '5',
        name: 'Grooming Service Consent',
        type: 'TXT',
        size: '10 KB',
        uploadDate: '2026-01-25',
        category: 'Grooming'
    },
    {
        id: '6',
        name: 'Emergency Treatment Authorization',
        type: 'TXT',
        size: '14 KB',
        uploadDate: '2026-01-28',
        category: 'Emergency'
    }
];
