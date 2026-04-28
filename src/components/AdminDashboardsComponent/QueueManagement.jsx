import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { CheckCircle2, XCircle, Clock, AlertCircle, Edit3, ChevronDown, ChevronUp } from 'lucide-react';
import AddQueueDialog from './AddQueueDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../ui/dialog';

export default function QueueManagement() {
    const [queue, setQueue] = useState(mockQueue);
    const [expandedRows, setExpandedRows] = useState(new Set());

    const toggleRow = (id) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleAddToQueue = (pet, service, priority, complaint) => {
        const newQueueItem = {
            id: Date.now().toString(),
            queueNumber: queue.length + 1,
            petName: pet.name,
            ownerName: pet.owner,
            service: service,
            timestamp: new Date().toLocaleString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }),
            status: 'waiting',
            priority: priority,
            complaint: complaint
        };
        setQueue([...queue, newQueueItem]);
    };

    const handleApprove = (id) => {
        updateStatus(id, 'in-progress');
    };

    const handleCancel = (id) => {
        updateStatus(id, 'cancelled');
    };

    const updateStatus = (id, newStatus) => {
        setQueue(items =>
            items.map(item =>
                item.id === id ? { ...item, status: newStatus } : item
            )
        );
    };

    // Filter queues
    const activeQueue = queue.filter(item => item.status !== 'completed' && item.status !== 'cancelled');
    const completedQueue = queue.filter(item => item.status === 'completed');
    const cancelledCount = queue.filter(item => item.status === 'cancelled').length;

    const getStatusBadge = (status) => {
        const variants = {
            'waiting': { variant: 'outline', icon: Clock, text: 'Waiting' },
            'in-progress': { variant: 'default', icon: AlertCircle, text: 'In Progress' },
            'completed': { variant: 'default', icon: CheckCircle2, text: 'Completed' },
            'cancelled': { variant: 'destructive', icon: XCircle, text: 'Cancelled' }
        };

        const { variant, icon: Icon, text } = variants[status];

        return (
            <Badge variant={variant} className="flex items-center gap-1">
                <Icon className="size-3" />
                {text}
            </Badge>
        );
    };

    const getPriorityBadge = (priority) => {
        return priority === 'urgent' ? (
            <Badge variant="destructive">Urgent</Badge>
        ) : (
            <Badge variant="secondary">Normal</Badge>
        );
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-['Arimo:Bold',sans-serif] font-bold text-[24px] text-[#101828] mb-2">
                        Current Queue
                    </h2>
                    <p className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#4a5565]">
                        Manage and track all patients in the queue
                    </p>
                </div>
                <AddQueueDialog onAddToQueue={handleAddToQueue} />
            </div>

            {/* Stats */}
            <div className="flex gap-6">
                <div className="flex items-center gap-2">
                    <span className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">Active Queue:</span>
                    <span className="bg-[#eff6ff] text-[#155dfc] font-['Arimo:Bold',sans-serif] font-bold text-[14px] px-2 py-1 rounded-[8px]">
            {activeQueue.length}
          </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">Completed Today:</span>
                    <span className="bg-[#e0f2e9] text-[#0c6a3c] font-['Arimo:Bold',sans-serif] font-bold text-[14px] px-2 py-1 rounded-[8px]">
            {completedQueue.length}
          </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">Cancelled Today:</span>
                    <span className="bg-[#ffe6e6] text-[#d92d20] font-['Arimo:Bold',sans-serif] font-bold text-[14px] px-2 py-1 rounded-[8px]">
            {cancelledCount}
          </span>
                </div>
            </div>

            {/* Active Queue Table */}
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="font-['Arimo:Bold',sans-serif] w-[50px]"></TableHead>
                        <TableHead className="font-['Arimo:Bold',sans-serif]">Queue #</TableHead>
                        <TableHead className="font-['Arimo:Bold',sans-serif]">Pet Name</TableHead>
                        <TableHead className="font-['Arimo:Bold',sans-serif]">Owner</TableHead>
                        <TableHead className="font-['Arimo:Bold',sans-serif]">Service</TableHead>
                        <TableHead className="font-['Arimo:Bold',sans-serif]">Time</TableHead>
                        <TableHead className="font-['Arimo:Bold',sans-serif]">Priority</TableHead>
                        <TableHead className="font-['Arimo:Bold',sans-serif]">Status</TableHead>
                        <TableHead className="font-['Arimo:Bold',sans-serif]">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {activeQueue.flatMap((item) => {
                        const isExpanded = expandedRows.has(item.id);
                        const rows = [
                            <TableRow key={item.id} className="border-b-0">
                                <TableCell className="w-[50px]">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleRow(item.id)}
                                        className="h-8 w-8 p-0"
                                    >
                                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </Button>
                                </TableCell>
                                <TableCell className="font-['Arimo:Bold',sans-serif] text-[18px]">
                                    #{item.queueNumber}
                                </TableCell>
                                <TableCell className="font-['Arimo:Regular',sans-serif]">
                                    {item.petName}
                                </TableCell>
                                <TableCell className="font-['Arimo:Regular',sans-serif]">
                                    {item.ownerName}
                                </TableCell>
                                <TableCell className="font-['Arimo:Regular',sans-serif]">
                                    {item.service}
                                </TableCell>
                                <TableCell className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                                    {item.timestamp}
                                </TableCell>
                                <TableCell>
                                    {getPriorityBadge(item.priority)}
                                </TableCell>
                                <TableCell>
                                    {getStatusBadge(item.status)}
                                </TableCell>
                                <TableCell>
                                    <div className="flex gap-2">
                                        {item.status === 'waiting' && (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="default"
                                                    onClick={() => handleApprove(item.id)}
                                                    className="bg-[#155dfc] hover:bg-[#0d4acf] h-8"
                                                >
                                                    Approve
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => handleCancel(item.id)}
                                                    className="h-8"
                                                >
                                                    Cancel
                                                </Button>
                                            </>
                                        )}
                                        {item.status === 'in-progress' && (
                                            <Badge variant="default" className="bg-[#155dfc]">Processing</Badge>
                                        )}
                                        {item.status === 'cancelled' && (
                                            <Badge variant="destructive">Cancelled</Badge>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ];

                        if (isExpanded) {
                            rows.push(
                                <TableRow key={`${item.id}-details`} className="bg-[#f9fafb] border-b">
                                    <TableCell colSpan={9} className="py-4">
                                        <div className="px-4 space-y-3">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828] mb-1">Complaint</p>
                                                    <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                                                        {item.complaint || 'No complaint specified'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828] mb-1">Contact Number</p>
                                                    <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                                                        {item.contactNumber || 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828] mb-1">Address</p>
                                                <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                                                    {item.address || 'N/A'}
                                                </p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200">
                                                <div>
                                                    <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828] mb-1">Service</p>
                                                    <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                                                        {item.service}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828] mb-1">Appointment Time</p>
                                                    <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                                                        {item.timestamp}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        }

                        return rows;
                    })}
                </TableBody>
            </Table>

            {activeQueue.length === 0 && (
                <div className="py-12 text-center">
                    <p className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#4a5565]">
                        No items in active queue
                    </p>
                </div>
            )}

            {/* Completed Queue Section */}
            {completedQueue.length > 0 && (
                <div className="mt-12 space-y-4">
                    <div>
                        <h3 className="font-['Arimo:Bold',sans-serif] font-bold text-[20px] text-[#101828] mb-2">
                            Completed Queue
                        </h3>
                        <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                            All completed appointments today
                        </p>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="font-['Arimo:Bold',sans-serif]">Queue #</TableHead>
                                <TableHead className="font-['Arimo:Bold',sans-serif]">Pet Name</TableHead>
                                <TableHead className="font-['Arimo:Bold',sans-serif]">Owner</TableHead>
                                <TableHead className="font-['Arimo:Bold',sans-serif]">Service</TableHead>
                                <TableHead className="font-['Arimo:Bold',sans-serif]">Time</TableHead>
                                <TableHead className="font-['Arimo:Bold',sans-serif]">Priority</TableHead>
                                <TableHead className="font-['Arimo:Bold',sans-serif]">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {completedQueue.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-['Arimo:Bold',sans-serif] text-[18px]">
                                        #{item.queueNumber}
                                    </TableCell>
                                    <TableCell className="font-['Arimo:Regular',sans-serif]">
                                        {item.petName}
                                    </TableCell>
                                    <TableCell className="font-['Arimo:Regular',sans-serif]">
                                        {item.ownerName}
                                    </TableCell>
                                    <TableCell className="font-['Arimo:Regular',sans-serif]">
                                        {item.service}
                                    </TableCell>
                                    <TableCell className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                                        {item.timestamp}
                                    </TableCell>
                                    <TableCell>
                                        {getPriorityBadge(item.priority)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="default" className="bg-[#0c6a3c] flex items-center gap-1">
                                            <CheckCircle2 className="size-3" />
                                            Completed
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}

const mockQueue = [
    {
        id: '1',
        queueNumber: 1,
        petName: 'Max',
        ownerName: 'Test User',
        service: 'General Check-Up',
        timestamp: '2026-02-08 09:00 AM',
        status: 'in-progress',
        priority: 'normal',
        complaint: 'Loss of appetite and lethargy for the past 3 days',
        contactNumber: '+1 (555) 123-4567',
        address: '123 Main Street, Springfield, IL 62701'
    },
    {
        id: '2',
        queueNumber: 2,
        petName: 'Luna',
        ownerName: 'Jane Smith',
        service: 'Vaccination',
        timestamp: '2026-02-08 09:15 AM',
        status: 'waiting',
        priority: 'normal',
        complaint: 'Annual vaccination due',
        contactNumber: '+1 (555) 234-5678',
        address: '456 Oak Avenue, Springfield, IL 62702'
    },
    {
        id: '3',
        queueNumber: 3,
        petName: 'Charlie',
        ownerName: 'John Doe',
        service: 'Wellness Check-up',
        timestamp: '2026-02-08 09:30 AM',
        status: 'waiting',
        priority: 'urgent',
        complaint: 'Vomiting and diarrhea since yesterday evening',
        contactNumber: '+1 (555) 345-6789',
        address: '789 Pine Road, Springfield, IL 62703'
    },
    {
        id: '4',
        queueNumber: 4,
        petName: 'Bella',
        ownerName: 'Sarah Johnson',
        service: 'Grooming',
        timestamp: '2026-02-08 09:45 AM',
        status: 'waiting',
        priority: 'normal',
        complaint: 'Regular grooming appointment',
        contactNumber: '+1 (555) 456-7890',
        address: '321 Elm Street, Springfield, IL 62704'
    },
    {
        id: '5',
        queueNumber: 5,
        petName: 'Rocky',
        ownerName: 'Mike Brown',
        service: 'General Check-Up',
        timestamp: '2026-02-08 08:30 AM',
        status: 'completed',
        priority: 'normal',
        complaint: 'Routine health checkup',
        contactNumber: '+1 (555) 567-8901',
        address: '654 Maple Drive, Springfield, IL 62705'
    }
];