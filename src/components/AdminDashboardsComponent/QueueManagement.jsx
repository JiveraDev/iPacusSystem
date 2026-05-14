import { useState, useEffect, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Input } from '../../ui/input';
import { CheckCircle2, XCircle, Clock, AlertCircle, ChevronDown, ChevronUp, Search, ImageIcon } from 'lucide-react';
import AddQueueDialog from './AddQueueDialog';
import { toast } from '../../reusecomponent/toast.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function QueueManagement() {
    const [queue, setQueue] = useState([]);
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [serviceFilter, setServiceFilter] = useState('all');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchQueues();
    }, []);

    const fetchQueues = async () => {
        try {
            const response = await fetch(`${API_BASE}/queues`);
            const data = await response.json();
            if (Array.isArray(data)) {
                setQueue(data);
            }
        } catch (error) {
            console.error('Error fetching queues:', error);
        } finally {
            setLoading(false);
        }
    };

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

    const handleApprove = async (id) => {
        await updateStatus(id, 'in-progress');
    };

    const handleCancel = async (id) => {
        await updateStatus(id, 'cancelled');
    };

    const updateStatus = async (id, newStatus) => {
        try {
            const response = await fetch(`${API_BASE}/queues/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ queue_id: id, status: newStatus })
            });
            const data = await response.json();
            if (data.success) {
                setQueue(items =>
                    items.map(item =>
                        item.queue_id === id ? { ...item, status: newStatus } : item
                    )
                );
            }
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const isSameLocalDay = (dateValue, referenceDate) => {
        const date = new Date(dateValue);
        return (
            date.getFullYear() === referenceDate.getFullYear() &&
            date.getMonth() === referenceDate.getMonth() &&
            date.getDate() === referenceDate.getDate()
        );
    };

    // Filter logic
    const filteredQueue = useMemo(() => {
        return queue.filter(item => {
            const ownerText = item.owner_name
                ? `${item.owner_name} (${item.owner_status === 'unregistered' ? 'Unregistered' : 'Registered'})`
                : `${item.first_Name || ''} ${item.last_Name || ''}`.trim();
            const matchesSearch = 
                item.pet_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                ownerText.toLowerCase().includes(searchTerm.toLowerCase()) ||
                `#${item.queue_number}`.includes(searchTerm);
            
            const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
            const matchesService = serviceFilter === 'all' || item.service_name === serviceFilter;

            return matchesSearch && matchesPriority && matchesService;
        });
    }, [queue, searchTerm, priorityFilter, serviceFilter]);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const todayFilteredQueue = filteredQueue.filter(item => isSameLocalDay(item.timestamp, now));
    const yesterdayFilteredQueue = filteredQueue.filter(item => isSameLocalDay(item.timestamp, yesterday));

    const activeQueue = todayFilteredQueue.filter(item => item.status !== 'completed' && item.status !== 'cancelled');
    const completedQueue = todayFilteredQueue.filter(item => item.status === 'completed');
    const missedQueue = yesterdayFilteredQueue.filter(item => item.status === 'waiting' || item.status === 'in-progress');

    const todayQueue = queue.filter(item => isSameLocalDay(item.timestamp, now));
    const activeCount = todayQueue.filter(item => item.status !== 'completed' && item.status !== 'cancelled').length;
    const completedCount = todayQueue.filter(item => item.status === 'completed').length;
    const cancelledCount = todayQueue.filter(item => item.status === 'cancelled').length;

    const services = useMemo(() => {
        const uniqueServices = [...new Set(queue.map(item => item.service_name))];
        return uniqueServices.filter(Boolean);
    }, [queue]);

    const getStatusBadge = (status) => {
        const variants = {
            'waiting': { variant: 'outline', icon: Clock, text: 'Waiting' },
            'in-progress': { variant: 'default', icon: AlertCircle, text: 'In Progress' },
            'completed': { variant: 'default', icon: CheckCircle2, text: 'Completed' },
            'cancelled': { variant: 'destructive', icon: XCircle, text: 'Cancelled' }
        };

        const { variant, icon: Icon, text } = variants[status] || variants['waiting'];

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

    const getSourceBadge = (sourceValue) => {
        const source = (sourceValue || 'admin').toLowerCase();
        if (source === 'self_service') return <Badge variant="outline">Self Service</Badge>;
        if (source === 'register') return <Badge variant="outline">On Register</Badge>;
        if (source === 'booking_management') return <Badge variant="default" className="bg-[#155dfc]">Booking</Badge>;
        return <Badge variant="secondary">Admin</Badge>;
    };

    const formatDateTime = (value) =>
        new Date(value).toLocaleString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

    const handleReEnterQueue = async (queueId) => {
        try {
            const response = await fetch(`${API_BASE}/queues/reenter`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ queue_id: queueId })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.success) {
                toast.error(data.message || 'Failed to re-enter queue');
                return;
            }
            toast.success('Queue item re-entered for today');
            await fetchQueues();
        } catch (error) {
            console.error('Error re-entering queue:', error);
            toast.error('Failed to re-enter queue');
        }
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
                <AddQueueDialog onAddToQueue={fetchQueues} />
            </div>

            {/* Stats */}
            <div className="flex gap-6">
                <div className="flex items-center gap-2">
                    <span className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">Active Queue:</span>
                    <span className="bg-[#eff6ff] text-[#155dfc] font-['Arimo:Bold',sans-serif] font-bold text-[14px] px-2 py-1 rounded-[8px]">
                        {activeCount}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">Completed Today:</span>
                    <span className="bg-[#e0f2e9] text-[#0c6a3c] font-['Arimo:Bold',sans-serif] font-bold text-[14px] px-2 py-1 rounded-[8px]">
                        {completedCount}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">Cancelled Today:</span>
                    <span className="bg-[#ffe6e6] text-[#d92d20] font-['Arimo:Bold',sans-serif] font-bold text-[14px] px-2 py-1 rounded-[8px]">
                        {cancelledCount}
                    </span>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-4" />
                    <Input 
                        placeholder="Search pet, owner, or queue #..." 
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-[150px]">
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                        <SelectTrigger>
                            <SelectValue placeholder="All Priorities" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Priorities</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="w-[200px]">
                    <Select value={serviceFilter} onValueChange={setServiceFilter}>
                        <SelectTrigger>
                            <SelectValue placeholder="All Services" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Services</SelectItem>
                            {services.map(service => (
                                <SelectItem key={service} value={service}>{service}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Active Queue Table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="font-['Arimo:Bold',sans-serif] w-[50px]"></TableHead>
                            <TableHead className="font-['Arimo:Bold',sans-serif]">Queue #</TableHead>
                            <TableHead className="font-['Arimo:Bold',sans-serif]">Pet Name</TableHead>
                            <TableHead className="font-['Arimo:Bold',sans-serif]">Owner</TableHead>
                            <TableHead className="font-['Arimo:Bold',sans-serif]">Service</TableHead>
                            <TableHead className="font-['Arimo:Bold',sans-serif]">Source</TableHead>
                            <TableHead className="font-['Arimo:Bold',sans-serif]">Time</TableHead>
                            <TableHead className="font-['Arimo:Bold',sans-serif]">Priority</TableHead>
                            <TableHead className="font-['Arimo:Bold',sans-serif]">Status</TableHead>
                            <TableHead className="font-['Arimo:Bold',sans-serif]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={10} className="text-center py-10 text-gray-500">Loading queue...</TableCell>
                            </TableRow>
                        ) : activeQueue.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={10} className="text-center py-10 text-gray-500">No active queue items found</TableCell>
                            </TableRow>
                        ) : activeQueue.flatMap((item) => {
                            const isExpanded = expandedRows.has(item.queue_id);
                            const rows = [
                                <TableRow key={item.queue_id} className="border-b-0 hover:bg-transparent">
                                    <TableCell className="w-[50px]">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleRow(item.queue_id)}
                                            className="h-8 w-8 p-0"
                                        >
                                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </Button>
                                    </TableCell>
                                    <TableCell className="font-['Arimo:Bold',sans-serif] text-[18px]">
                                        #{item.queue_number}
                                    </TableCell>
                                    <TableCell className="font-['Arimo:Regular',sans-serif]">
                                        {item.pet_name}
                                    </TableCell>
                                    <TableCell className="font-['Arimo:Regular',sans-serif]">
                                        {item.owner_name
                                            ? `${item.owner_name} (${item.owner_status === 'unregistered' ? 'Unregistered' : 'Registered'})`
                                            : `${item.first_Name || ''} ${item.last_Name || ''}`.trim()}
                                    </TableCell>
                                    <TableCell className="font-['Arimo:Regular',sans-serif]">
                                        {item.service_name}
                                    </TableCell>
                                    <TableCell>
                                        {getSourceBadge(item.queue_source)}
                                    </TableCell>
                                    <TableCell className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                                        {formatDateTime(item.timestamp)}
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
                                                        onClick={() => handleApprove(item.queue_id)}
                                                        className="bg-[#155dfc] hover:bg-[#0d4acf] h-8"
                                                    >
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => handleCancel(item.queue_id)}
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
                                    <TableRow key={`${item.queue_id}-details`} className="bg-[#f9fafb] border-b">
                                        <TableCell colSpan={10} className="py-4">
                                            <div className="px-4 space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-3">
                                                        <div>
                                                            <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828] mb-1">Complaint</p>
                                                            <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565] bg-white p-3 rounded border border-gray-100">
                                                                {item.complaint || 'No complaint specified'}
                                                            </p>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828] mb-1">Contact Number</p>
                                                                <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                                                                    {item.contactNumber || 'N/A'}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828] mb-1">Appointment Time</p>
                                                                <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                                                                    {formatDateTime(item.timestamp)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828] mb-1">Address</p>
                                                            <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                                                                {item.address || 'N/A'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="border-l border-gray-200 pl-6 space-y-4">
                                                        <div>
                                                            <p className="font-['Arimo:Bold',sans-serif] text-[12px] text-[#6b7280] mb-1">Source</p>
                                                            <div>
                                                                {getSourceBadge(item.queue_source)}
                                                            </div>
                                                        </div>
                                                        {/* Image of Concern Section */}
                                                        {item.image_path && (
                                                            <div>
                                                            <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828] mb-2 flex items-center gap-2">
                                                                <ImageIcon className="size-4 text-gray-500" />
                                                                Image of Concern
                                                            </p>
                                                            <div className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50 aspect-video flex items-center justify-center">
                                                                <img 
                                                                    src={`/${item.image_path}`} 
                                                                    alt="Concern" 
                                                                    className="max-h-full object-contain cursor-pointer hover:scale-105 transition-transform"
                                                                    onClick={() => window.open(`/${item.image_path}`, '_blank')}
                                                                />
                                                            </div>
                                                        </div>
                                                        )}
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
            </div>

            {/* Completed Queue Section */}
            {completedQueue.length > 0 && (
                <div className="mt-12 space-y-4">
                    <div>
                        <h3 className="font-['Arimo:Bold',sans-serif] font-bold text-[20px] text-[#101828] mb-2">
                            Completed Queue
                        </h3>
                        <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                            Completed appointments for today matching current filters
                        </p>
                    </div>

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="font-['Arimo:Bold',sans-serif]">Queue #</TableHead>
                                    <TableHead className="font-['Arimo:Bold',sans-serif]">Pet Name</TableHead>
                                    <TableHead className="font-['Arimo:Bold',sans-serif]">Owner</TableHead>
                                    <TableHead className="font-['Arimo:Bold',sans-serif]">Service</TableHead>
                                    <TableHead className="font-['Arimo:Bold',sans-serif]">Source</TableHead>
                                    <TableHead className="font-['Arimo:Bold',sans-serif]">Time</TableHead>
                                    <TableHead className="font-['Arimo:Bold',sans-serif]">Priority</TableHead>
                                    <TableHead className="font-['Arimo:Bold',sans-serif]">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {completedQueue.map((item) => (
                                    <TableRow key={item.queue_id}>
                                        <TableCell className="font-['Arimo:Bold',sans-serif] text-[18px]">
                                            #{item.queue_number}
                                        </TableCell>
                                        <TableCell className="font-['Arimo:Regular',sans-serif]">
                                            {item.pet_name}
                                        </TableCell>
                                        <TableCell className="font-['Arimo:Regular',sans-serif]">
                                            {item.owner_name
                                                ? `${item.owner_name} (${item.owner_status === 'unregistered' ? 'Unregistered' : 'Registered'})`
                                                : `${item.first_Name || ''} ${item.last_Name || ''}`.trim()}
                                        </TableCell>
                                        <TableCell className="font-['Arimo:Regular',sans-serif]">
                                            {item.service_name}
                                        </TableCell>
                                        <TableCell>
                                            {getSourceBadge(item.queue_source)}
                                        </TableCell>
                                        <TableCell className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                                            {formatDateTime(item.timestamp)}
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
                </div>
            )}

            <div className="mt-12 space-y-4">
                <div>
                    <h3 className="font-['Arimo:Bold',sans-serif] font-bold text-[20px] text-[#101828] mb-2">
                        Missed Queue (Yesterday)
                    </h3>
                    <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                        Yesterday's waiting/in-progress queue items. Re-enter creates a new queue record for today.
                    </p>
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="font-['Arimo:Bold',sans-serif]">Queue #</TableHead>
                                <TableHead className="font-['Arimo:Bold',sans-serif]">Pet Name</TableHead>
                                <TableHead className="font-['Arimo:Bold',sans-serif]">Owner</TableHead>
                                <TableHead className="font-['Arimo:Bold',sans-serif]">Service</TableHead>
                                <TableHead className="font-['Arimo:Bold',sans-serif]">Source</TableHead>
                                <TableHead className="font-['Arimo:Bold',sans-serif]">Time</TableHead>
                                <TableHead className="font-['Arimo:Bold',sans-serif]">Priority</TableHead>
                                <TableHead className="font-['Arimo:Bold',sans-serif]">Status</TableHead>
                                <TableHead className="font-['Arimo:Bold',sans-serif]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {missedQueue.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-10 text-gray-500">No missed queue items from yesterday</TableCell>
                                </TableRow>
                            ) : (
                                missedQueue.map((item) => (
                                    <TableRow key={`missed-${item.queue_id}`}>
                                        <TableCell className="font-['Arimo:Bold',sans-serif] text-[18px]">
                                            #{item.queue_number}
                                        </TableCell>
                                        <TableCell className="font-['Arimo:Regular',sans-serif]">{item.pet_name}</TableCell>
                                        <TableCell className="font-['Arimo:Regular',sans-serif]">
                                            {item.owner_name
                                                ? `${item.owner_name} (${item.owner_status === 'unregistered' ? 'Unregistered' : 'Registered'})`
                                                : `${item.first_Name || ''} ${item.last_Name || ''}`.trim()}
                                        </TableCell>
                                        <TableCell className="font-['Arimo:Regular',sans-serif]">{item.service_name}</TableCell>
                                        <TableCell>{getSourceBadge(item.queue_source)}</TableCell>
                                        <TableCell className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                                            {formatDateTime(item.timestamp)}
                                        </TableCell>
                                        <TableCell>{getPriorityBadge(item.priority)}</TableCell>
                                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                                        <TableCell>
                                            <Button
                                                size="sm"
                                                variant="default"
                                                className="bg-[#155dfc] hover:bg-[#0d4acf] h-8"
                                                onClick={() => handleReEnterQueue(item.queue_id)}
                                            >
                                                Re-enter
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
