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
    const [missedAgeFilter, setMissedAgeFilter] = useState('7d');
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

    const activeQueue = todayFilteredQueue.filter(item => item.status !== 'completed' && item.status !== 'done' && item.status !== 'cancelled');
    const completedQueue = todayFilteredQueue.filter(item => item.status === 'completed' || item.status === 'done');
    
    const missedQueue = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const ageLimits = {
            '7d': 7,
            '14d': 14,
            '30d': 30
        };
        const limitDays = ageLimits[missedAgeFilter] || 7;

        const missedMap = new Map();

        filteredQueue.forEach(item => {
            const itemDate = new Date(item.timestamp);
            if (itemDate >= today) return;

            const isMissed = item.status !== 'completed' && item.status !== 'done' && item.status !== 'cancelled';
            if (!isMissed) return;

            const diffTime = Math.abs(today - itemDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays <= limitDays) {
                const existing = missedMap.get(item.pet_id);
                // Keep only the newest (latest timestamp) per pet
                if (!existing || new Date(item.timestamp) > new Date(existing.timestamp)) {
                    missedMap.set(item.pet_id, item);
                }
            }
        });

        return Array.from(missedMap.values()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }, [filteredQueue, missedAgeFilter]);

    const todayQueue = queue.filter(item => isSameLocalDay(item.timestamp, now));
    const activeCount = todayQueue.filter(item => item.status !== 'completed' && item.status !== 'done' && item.status !== 'cancelled').length;
    const completedCount = todayQueue.filter(item => item.status === 'completed' || item.status === 'done').length;
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
            'done': { variant: 'default', icon: CheckCircle2, text: 'Done' },
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
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
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
            <div className="flex flex-wrap gap-4 sm:gap-6">
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
            <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-100 bg-white p-4 shadow-sm md:grid-cols-[minmax(240px,1fr)_150px_200px] md:items-center">
                <div className="relative min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-4" />
                    <Input 
                        placeholder="Search pet, owner, or queue #..." 
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-full">
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
                <div className="w-full">
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
            <div className="rounded-md border overflow-x-auto bg-white">
                <Table className="min-w-[760px]">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="font-['Arimo:Bold',sans-serif] w-[40px]"></TableHead>
                            <TableHead className="font-['Arimo:Bold',sans-serif]">#</TableHead>
                            <TableHead className="font-['Arimo:Bold',sans-serif]">Pet Name</TableHead>
                            <TableHead className="font-['Arimo:Bold',sans-serif] hidden md:table-cell">Owner</TableHead>
                            <TableHead className="font-['Arimo:Bold',sans-serif] hidden lg:table-cell">Service</TableHead>
                            <TableHead className="font-['Arimo:Bold',sans-serif] hidden xl:table-cell">Source</TableHead>
                            <TableHead className="font-['Arimo:Bold',sans-serif] hidden md:table-cell">Time</TableHead>
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
                                    <TableCell className="w-[40px]">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleRow(item.queue_id)}
                                            className="h-8 w-8 p-0"
                                        >
                                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </Button>
                                    </TableCell>
                                    <TableCell className="font-['Arimo:Bold',sans-serif] text-[16px] sm:text-[18px]">
                                        {item.queue_number}
                                    </TableCell>
                                    <TableCell className="font-['Arimo:Regular',sans-serif]">
                                        <div className="max-w-[100px] sm:max-w-none truncate sm:whitespace-normal">
                                            {item.pet_name}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-['Arimo:Regular',sans-serif] hidden md:table-cell">
                                        {item.owner_name
                                            ? `${item.owner_name} (${item.owner_status === 'unregistered' ? 'Unregistered' : 'Registered'})`
                                            : `${item.first_Name || ''} ${item.last_Name || ''}`.trim()}
                                    </TableCell>
                                    <TableCell className="font-['Arimo:Regular',sans-serif] hidden lg:table-cell">
                                        {item.service_name}
                                    </TableCell>
                                    <TableCell className="hidden xl:table-cell">
                                        {getSourceBadge(item.queue_source)}
                                    </TableCell>
                                    <TableCell className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565] hidden md:table-cell">
                                        {formatDateTime(item.timestamp)}
                                    </TableCell>
                                    <TableCell>
                                        {getPriorityBadge(item.priority)}
                                    </TableCell>
                                    <TableCell>
                                        {getStatusBadge(item.status)}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-2 sm:flex-row">
                                            {item.status === 'waiting' && (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        variant="default"
                                                        onClick={() => handleApprove(item.queue_id)}
                                                        className="bg-[#155dfc] hover:bg-[#0d4acf] h-8 px-2 sm:px-3 text-[12px] sm:text-[14px]"
                                                    >
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => handleCancel(item.queue_id)}
                                                        className="h-8 px-2 sm:px-3 text-[12px] sm:text-[14px]"
                                                    >
                                                        Cancel
                                                    </Button>
                                                </>
                                            )}
                                            {item.status === 'in-progress' && (
                                                <Badge variant="default" className="bg-[#155dfc]">In-Progress</Badge>
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
                                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

                                                    <div className="space-y-4 border-gray-200 md:border-l md:pl-6">
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
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h3 className="font-['Arimo:Bold',sans-serif] font-bold text-[20px] text-[#101828] mb-2">
                            Missed Queue
                        </h3>
                        <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                            Queue items from previous days that were not completed or cancelled.
                        </p>
                    </div>
                    <div className="w-full md:w-[200px]">
                        <Select value={missedAgeFilter} onValueChange={setMissedAgeFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Timeframe" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="7d">Last 7 Days</SelectItem>
                                <SelectItem value="14d">Last 2 Weeks</SelectItem>
                                <SelectItem value="30d">Last 1 Month</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="rounded-md border overflow-x-auto">
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
                                    <TableCell colSpan={9} className="text-center py-10 text-gray-500">No missed queue items found for this period</TableCell>
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
