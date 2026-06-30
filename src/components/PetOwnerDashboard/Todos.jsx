import { useMemo, useState } from 'react';
import {
    CalendarDays,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    CreditCard,
    Loader2,
    PanelRightClose,
    PanelRightOpen,
    Pencil,
    Plus,
    RefreshCw,
    Stethoscope,
    Trash2,
    Video
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Badge } from '../../ui/badge';
import { Checkbox } from '../../ui/checkbox';
import { format, isSameDay } from '../../lib/date';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { toast } from '../../reusecomponent/toast.jsx';
import {
    createPetOwnerTodo,
    deletePetOwnerTodo,
    fetchPetOwnerTodos,
    updatePetOwnerTodo
} from '../../services/todoService';
import { useNavigate } from '../dashboardRouter.jsx';

const CATEGORY_OPTIONS = [
    'Personal Task',
    'Medication',
    'Follow-up',
    'Grooming',
    'Feeding',
    'Exercise',
    'Other'
];

const CATEGORY_STYLES = {
    Booking: { dot: 'bg-blue-600', badge: 'bg-blue-50 text-blue-700', border: 'border-blue-200' },
    Boarding: { dot: 'bg-cyan-600', badge: 'bg-cyan-50 text-cyan-700', border: 'border-cyan-200' },
    Payment: { dot: 'bg-emerald-600', badge: 'bg-emerald-50 text-emerald-700', border: 'border-emerald-200' },
    'Follow-up': { dot: 'bg-violet-600', badge: 'bg-violet-50 text-violet-700', border: 'border-violet-200' },
    Medication: { dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700', border: 'border-amber-200' },
    'Personal Task': { dot: 'bg-slate-600', badge: 'bg-slate-100 text-slate-700', border: 'border-slate-200' },
    Other: { dot: 'bg-slate-500', badge: 'bg-slate-100 text-slate-700', border: 'border-slate-200' }
};

CATEGORY_STYLES['Online Consultation'] = { dot: 'bg-blue-600', badge: 'bg-blue-50 text-blue-700', border: 'border-blue-200' };

function getUserId(user) {
    return user?.id || user?.user_id || user?.userId || '';
}

function normalizeRole(role) {
    return String(role || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
}

function isVeterinarianRole(role) {
    const normalized = normalizeRole(role);
    return normalized === 'vet' || normalized.includes('veterinarian');
}

function parseTaskDate(value) {
    if (!value) return null;

    const date = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(date.getTime()) ? null : date;
}

function dateInputValue(date) {
    if (!date) return '';
    return format(date, 'yyyy-MM-dd');
}

function timeInputValue(date) {
    if (!date) return '09:00';
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
}

function addDays(date, amount) {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return next;
}

function calendarRange(monthDate) {
    const firstDay = startOfMonth(monthDate);
    const lastDay = endOfMonth(monthDate);
    const start = addDays(firstDay, -firstDay.getDay());
    const end = addDays(lastDay, 6 - lastDay.getDay());

    return { start, end };
}

function monthLabel(date) {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function combineDateTime(dateValue, timeValue) {
    if (!dateValue) return '';
    return `${dateValue} ${timeValue || '09:00'}:00`;
}

function displayTime(value) {
    const date = parseTaskDate(value);
    if (!date) return '';
    return format(date, 'p');
}

function displayDateTime(value) {
    const date = parseTaskDate(value);
    if (!date) return 'Not scheduled';
    return `${format(date, 'PPP')} at ${format(date, 'p')}`;
}

function taskStyle(task) {
    return CATEGORY_STYLES[task.category] || CATEGORY_STYLES[task.source === 'personal' ? 'Personal Task' : 'Other'];
}

function isTaskDone(task) {
    return task.status === 'completed' || task.status === 'cancelled';
}

function isTaskOverdue(task) {
    const date = parseTaskDate(task.startAt);
    return date && !isTaskDone(task) && date.getTime() < Date.now();
}

function emptyForm(date = new Date()) {
    return {
        title: '',
        details: '',
        category: 'Personal Task',
        date: dateInputValue(date),
        time: '09:00'
    };
}

function petProfilePath(task) {
    if (typeof task.redirectPath === 'string' && task.redirectPath.startsWith('/dashboard/my-pets/')) {
        return task.redirectPath;
    }

    const petId = task.petShareableId || task.petId;
    return petId ? `/dashboard/my-pets/${petId}` : '';
}

export default function Todos({ user }) {
    const navigate = useNavigate();
    const userId = getUserId(user);
    const isVeterinarian = isVeterinarianRole(user?.role);
    const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
    const [selectedDate, setSelectedDate] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [editingTask, setEditingTask] = useState(null);
    const [isAgendaOpen, setIsAgendaOpen] = useState(true);
    const [form, setForm] = useState(() => emptyForm(new Date()));

    const range = useMemo(() => calendarRange(currentMonth), [currentMonth]);

    const loadTasks = async ({ isAutoRefresh = false } = {}) => {
        if (!userId) return null;

        if (!isAutoRefresh) {
            setIsLoading(true);
            setLoadError('');
        }

        try {
            const data = await fetchPetOwnerTodos(userId, {
                start: dateInputValue(range.start),
                end: dateInputValue(range.end),
                role: user?.role || ''
            });
            setTasks(Array.isArray(data.tasks) ? data.tasks : []);
            return data;
        } catch (error) {
            if (!isAutoRefresh) {
                setLoadError(error.message || 'TODOs could not be loaded.');
            }
            return null;
        } finally {
            if (!isAutoRefresh) {
                setIsLoading(false);
            }
        }
    };

    useAutoRefresh(loadTasks, {
        enabled: Boolean(userId),
        intervalMs: 10000,
        refreshKey: `todos-${normalizeRole(user?.role)}-${userId}-${dateInputValue(range.start)}-${dateInputValue(range.end)}`
    });

    const calendarDays = useMemo(() => {
        const days = [];
        let current = new Date(range.start);

        while (current <= range.end) {
            days.push(new Date(current));
            current = addDays(current, 1);
        }

        return days;
    }, [range]);

    const tasksByDay = useMemo(() => {
        const grouped = new Map();

        tasks.forEach(task => {
            const date = parseTaskDate(task.startAt);
            if (!date) return;

            const key = dateInputValue(date);
            grouped.set(key, [...(grouped.get(key) || []), task]);
        });

        grouped.forEach(dayTasks => {
            dayTasks.sort((left, right) => {
                const leftTime = parseTaskDate(left.startAt)?.getTime() || 0;
                const rightTime = parseTaskDate(right.startAt)?.getTime() || 0;
                return leftTime - rightTime;
            });
        });

        return grouped;
    }, [tasks]);

    const selectedTasks = useMemo(() => {
        if (!selectedDate) return [];
        return tasksByDay.get(dateInputValue(selectedDate)) || [];
    }, [selectedDate, tasksByDay]);

    const upcomingTasks = useMemo(() => (
        tasks
            .filter(task => {
                const date = parseTaskDate(task.startAt);
                if (!date || isTaskDone(task)) return false;
                const sevenDays = Date.now() + 7 * 24 * 60 * 60 * 1000;
                return date.getTime() <= sevenDays;
            })
            .sort((left, right) => (parseTaskDate(left.startAt)?.getTime() || 0) - (parseTaskDate(right.startAt)?.getTime() || 0))
            .slice(0, 8)
    ), [tasks]);

    const openDay = (date) => {
        setSelectedDate(date);
        setEditingTask(null);
        setForm(emptyForm(date));
        setIsDialogOpen(true);
    };

    const openCreate = () => {
        const date = selectedDate || new Date();
        setSelectedDate(date);
        setEditingTask(null);
        setForm(emptyForm(date));
        setIsDialogOpen(true);
    };

    const openEdit = (task) => {
        const date = parseTaskDate(task.startAt) || new Date();
        setEditingTask(task);
        setForm({
            title: task.title || '',
            details: task.details || '',
            category: task.category || 'Personal Task',
            date: dateInputValue(date),
            time: timeInputValue(date)
        });
    };

    const resetForm = () => {
        setEditingTask(null);
        setForm(emptyForm(selectedDate || new Date()));
    };

    const saveTask = async () => {
        if (!userId) {
            toast.error('Session error. Please log in again.');
            return;
        }

        if (!form.title.trim() || !form.date) {
            toast.error('Task title and date are required.');
            return;
        }

        const payload = {
            title: form.title.trim(),
            details: form.details.trim(),
            category: form.category,
            startAt: combineDateTime(form.date, form.time)
        };

        setIsSaving(true);

        try {
            if (editingTask) {
                await updatePetOwnerTodo(editingTask.sourceId, userId, payload);
                toast.success('Task updated.');
            } else {
                await createPetOwnerTodo(userId, payload);
                toast.success('Task added.');
            }

            resetForm();
            await loadTasks();
        } catch (error) {
            toast.error(error.message || 'Task could not be saved.');
        } finally {
            setIsSaving(false);
        }
    };

    const completeTask = async (task) => {
        if (!task.editable) return;

        setIsSaving(true);
        try {
            await updatePetOwnerTodo(task.sourceId, userId, { status: task.status === 'completed' ? 'pending' : 'completed' });
            toast.success(task.status === 'completed' ? 'Task reopened.' : 'Task completed.');
            await loadTasks();
        } catch (error) {
            toast.error(error.message || 'Task could not be updated.');
        } finally {
            setIsSaving(false);
        }
    };

    const removeTask = async (task) => {
        if (!task.editable) return;

        setIsSaving(true);
        try {
            await deletePetOwnerTodo(task.sourceId, userId);
            toast.success('Task deleted.');
            await loadTasks();
            if (editingTask?.sourceId === task.sourceId) {
                resetForm();
            }
        } catch (error) {
            toast.error(error.message || 'Task could not be deleted.');
        } finally {
            setIsSaving(false);
        }
    };

    const changeMonth = (amount) => {
        setCurrentMonth(current => startOfMonth(new Date(current.getFullYear(), current.getMonth() + amount, 1)));
    };

    const openTaskPet = (task) => {
        const path = petProfilePath(task);
        if (path) {
            navigate(path);
        }
    };

    return (
        <div className="space-y-6 lg:space-y-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">
                        {isVeterinarian ? 'Schedule & TODOs' : 'TODOs & Schedule'}
                    </h1>
                    <p className="mt-2 text-sm font-medium text-slate-500">
                        {isVeterinarian
                            ? 'Online consultation appointments, follow-up recording, and personal tasks.'
                            : 'Clinic schedules, payments, follow-ups, boarding tasks, and personal reminders.'}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => loadTasks()} disabled={isLoading}>
                        {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                        Refresh
                    </Button>
                    <Button type="button" onClick={openCreate} className="bg-[#155dfc] text-white hover:bg-[#0d4acf]">
                        <Plus className="size-4" />
                        Add Task
                    </Button>
                </div>
            </div>

            {loadError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                    {loadError}
                </div>
            )}

            <div className={`grid gap-6 transition-[grid-template-columns] duration-300 xl:items-start ${isAgendaOpen ? 'xl:grid-cols-[minmax(0,1fr)_24rem]' : 'xl:grid-cols-1'}`}>
                <Card className="overflow-hidden rounded-lg border-slate-200 bg-white shadow-sm">
                    <CardHeader className="border-b border-slate-100">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <CardTitle className="flex items-center gap-2 text-lg font-black text-slate-950">
                                <CalendarDays className="size-5 text-[#155dfc]" />
                                {monthLabel(currentMonth)}
                            </CardTitle>
                            <div className="flex items-center gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => changeMonth(-1)} aria-label="Previous month">
                                    <ChevronLeft className="size-4" />
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => setCurrentMonth(startOfMonth(new Date()))}>
                                    Today
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => changeMonth(1)} aria-label="Next month">
                                    <ChevronRight className="size-4" />
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <div className="min-w-[44rem] p-4 lg:min-w-0">
                                <div className="grid grid-cols-7 gap-2 pb-2">
                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                        <div key={day} className="px-2 py-1 text-center text-xs font-black uppercase tracking-wide text-slate-400">
                                            {day}
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-2">
                                    {calendarDays.map(day => {
                                        const key = dateInputValue(day);
                                        const dayTasks = tasksByDay.get(key) || [];
                                        const isOutsideMonth = day.getMonth() !== currentMonth.getMonth();
                                        const isToday = isSameDay(day, new Date());

                                        return (
                                            <button
                                                type="button"
                                                key={key}
                                                onClick={() => openDay(day)}
                                                className={`relative min-h-32 rounded-lg border p-2 pt-11 text-left align-top transition hover:border-blue-300 hover:bg-blue-50/30 ${isToday ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white'} ${isOutsideMonth ? 'opacity-50' : ''}`}
                                            >
                                                <span className="absolute left-2 right-2 top-2 flex items-start justify-between gap-2">
                                                    <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-black ${isToday ? 'bg-[#155dfc] text-white' : 'text-slate-700'}`}>
                                                        {day.getDate()}
                                                    </span>
                                                    {dayTasks.length > 0 && (
                                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-600">
                                                            {dayTasks.length}
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="block space-y-1">
                                                    {dayTasks.slice(0, 3).map(task => {
                                                        const style = taskStyle(task);
                                                        return (
                                                            <span
                                                                key={task.id}
                                                                className={`block truncate rounded-md px-2 py-1 text-xs font-bold ${style.badge}`}
                                                                title={task.title}
                                                            >
                                                                {displayTime(task.startAt)} {task.title}
                                                            </span>
                                                        );
                                                    })}
                                                    {dayTasks.length > 3 && (
                                                        <span className="block px-2 text-xs font-bold text-slate-400">
                                                            +{dayTasks.length - 3} more
                                                        </span>
                                                    )}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <aside className={`relative rounded-lg border border-slate-200 bg-white shadow-sm xl:sticky xl:top-6 xl:self-start ${isAgendaOpen ? '' : 'xl:hidden'}`}>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsAgendaOpen(false)}
                            aria-label="Hide next 7 days"
                            aria-expanded={isAgendaOpen}
                            className="absolute -left-5 top-5 z-10 hidden size-10 rounded-full border-blue-200 bg-white p-0 text-[#155dfc] shadow-lg ring-2 ring-white transition hover:border-blue-300 hover:bg-blue-50 xl:inline-flex"
                        >
                            <PanelRightClose className="size-5" strokeWidth={2.4} />
                        </Button>
                        <div className="border-b border-slate-100 p-4 pl-6">
                            <h2 className="flex items-center gap-2 text-lg font-black text-slate-950">
                                <Clock className="size-5 text-[#155dfc]" />
                                Next 7 Days
                            </h2>
                        </div>
                        <div className="max-h-[36rem] space-y-3 overflow-y-auto p-4">
                            {isLoading && tasks.length === 0 ? (
                                <div className="flex items-center justify-center gap-2 py-10 text-sm font-semibold text-slate-500">
                                    <Loader2 className="size-4 animate-spin" />
                                    Loading schedules...
                                </div>
                            ) : upcomingTasks.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm font-semibold text-slate-400">
                                    No upcoming tasks.
                                </div>
                            ) : (
                                upcomingTasks.map(task => (
                                    <TaskRow
                                        key={task.id}
                                        task={task}
                                        onComplete={completeTask}
                                        onEdit={openEdit}
                                        onDelete={removeTask}
                                        onOpenPet={openTaskPet}
                                        compact
                                    />
                                ))
                            )}
                        </div>
                    </aside>
            </div>

            {!isAgendaOpen && (
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAgendaOpen(true)}
                    aria-label="Show next 7 days"
                    aria-expanded={isAgendaOpen}
                    className="fixed right-3 top-48 z-40 hidden size-12 items-center justify-center rounded-full border border-blue-200 bg-white p-0 text-[#155dfc] shadow-xl ring-2 ring-white transition hover:border-blue-300 hover:bg-blue-50 xl:inline-flex"
                >
                    <PanelRightOpen className="size-5" strokeWidth={2.4} />
                    {upcomingTasks.length > 0 && (
                        <span className="absolute -left-2 -top-2 flex size-6 items-center justify-center rounded-full bg-red-600 text-xs font-black text-white shadow-md">
                            {upcomingTasks.length}
                        </span>
                    )}
                </Button>
            )}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{selectedDate ? format(selectedDate, 'PPPP') : 'Schedule'}</DialogTitle>
                        <DialogDescription>
                            Clinic-generated items update from their source. Personal tasks can be edited here.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                        <div className="space-y-3">
                            <h3 className="text-sm font-black uppercase tracking-wide text-slate-400">
                                Day Schedule ({selectedTasks.length})
                            </h3>
                            {selectedTasks.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm font-semibold text-slate-400">
                                    Nothing scheduled for this day.
                                </div>
                            ) : (
                                selectedTasks.map(task => (
                                    <TaskRow
                                        key={task.id}
                                        task={task}
                                        onComplete={completeTask}
                                        onEdit={openEdit}
                                        onDelete={removeTask}
                                        onOpenPet={openTaskPet}
                                    />
                                ))
                            )}
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <h3 className="font-black text-slate-950">{editingTask ? 'Edit Task' : 'Add Task'}</h3>
                                {editingTask && (
                                    <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                                        New
                                    </Button>
                                )}
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="todo-title">Task Title</Label>
                                    <Input
                                        id="todo-title"
                                        value={form.title}
                                        onChange={(event) => setForm(current => ({ ...current, title: event.target.value }))}
                                        placeholder="Give medicine"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="todo-date">Date</Label>
                                        <Input
                                            id="todo-date"
                                            type="date"
                                            value={form.date}
                                            onChange={(event) => setForm(current => ({ ...current, date: event.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="todo-time">Time</Label>
                                        <Input
                                            id="todo-time"
                                            type="time"
                                            value={form.time}
                                            onChange={(event) => setForm(current => ({ ...current, time: event.target.value }))}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="todo-category">Category</Label>
                                    <Select
                                        value={form.category}
                                        onValueChange={(value) => setForm(current => ({ ...current, category: value }))}
                                        searchPlaceholder="Search category"
                                    >
                                        <SelectTrigger id="todo-category">
                                            <SelectValue placeholder="Select category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CATEGORY_OPTIONS.map(category => (
                                                <SelectItem key={category} value={category} searchText={category}>{category}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="todo-details">Details</Label>
                                    <Textarea
                                        id="todo-details"
                                        value={form.details}
                                        onChange={(event) => setForm(current => ({ ...current, details: event.target.value }))}
                                        placeholder="Notes, dosage, or reminders"
                                        className="min-h-24"
                                    />
                                </div>
                                <Button type="button" onClick={saveTask} disabled={isSaving} className="w-full bg-[#155dfc] text-white hover:bg-[#0d4acf]">
                                    {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                                    Save Task
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function TaskIcon({ task }) {
    if (task.source === 'payment') return <CreditCard className="size-4" />;
    if (task.source === 'online_consultation') return <Video className="size-4" />;
    if (task.source === 'diagnosis') return <Stethoscope className="size-4" />;
    if (task.source === 'vet_follow_up') return <Stethoscope className="size-4" />;
    if (task.source === 'booking' || task.source === 'boarding' || task.source === 'boarding_task') {
        return <CalendarDays className="size-4" />;
    }

    return <CheckCircle2 className="size-4" />;
}

function TaskRow({ task, onComplete, onEdit, onDelete, onOpenPet, compact = false }) {
    const style = taskStyle(task);
    const overdue = isTaskOverdue(task);
    const done = isTaskDone(task);
    const canOpenPet = Boolean(onOpenPet && petProfilePath(task));

    const handleOpenPet = () => {
        if (canOpenPet) {
            onOpenPet(task);
        }
    };

    const handleOpenPetKeyDown = (event) => {
        if (!canOpenPet) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleOpenPet();
        }
    };

    return (
        <div
            role={canOpenPet ? 'button' : undefined}
            tabIndex={canOpenPet ? 0 : undefined}
            onClick={handleOpenPet}
            onKeyDown={handleOpenPetKeyDown}
            className={`rounded-lg border bg-white p-3 shadow-sm ${style.border} ${done ? 'opacity-70' : ''} ${canOpenPet ? 'cursor-pointer transition hover:border-blue-300 hover:bg-blue-50/30' : ''}`}
        >
            <div className="flex items-start gap-3">
                <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${style.badge}`}>
                    <TaskIcon task={task} />
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h4 className="break-words text-sm font-black text-slate-950">{task.title}</h4>
                        <Badge className={`border-0 ${style.badge}`}>{task.category}</Badge>
                        {overdue && <Badge className="border-0 bg-red-50 text-red-700">Overdue</Badge>}
                        {done && <Badge className="border-0 bg-emerald-50 text-emerald-700">Done</Badge>}
                    </div>
                    {!compact && task.details && (
                        <p className="mt-1 whitespace-pre-wrap text-sm font-medium leading-5 text-slate-600">{task.details}</p>
                    )}
                    <p className="mt-2 text-xs font-bold text-slate-400">
                        {displayDateTime(task.startAt)}{task.petName ? ` - ${task.petName}` : ''}
                    </p>
                </div>
                {task.editable && (
                    <div className="flex shrink-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                            checked={task.status === 'completed'}
                            onCheckedChange={() => onComplete(task)}
                            aria-label="Mark task complete"
                            className="mt-2"
                        />
                        <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(task)} aria-label="Edit task">
                            <Pencil className="size-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => onDelete(task)} aria-label="Delete task" className="text-red-600 hover:bg-red-50 hover:text-red-700">
                            <Trash2 className="size-4" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
