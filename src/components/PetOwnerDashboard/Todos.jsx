import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Calendar, dayjsLocalizer, Views } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import {
    CalendarDays,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    CreditCard,
    Loader2,
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
import { format } from '../../lib/date';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { toast } from '../../reusecomponent/toast.jsx';
import {
    createPetOwnerTodo,
    deletePetOwnerTodo,
    fetchPetOwnerTodos,
    updatePetOwnerTodo
} from '../../services/todoService';
import { useNavigate } from '../dashboardRouter.jsx';

const calendarLocalizer = dayjsLocalizer(dayjs);

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

const CATEGORY_COLORS = {
    Booking: '#2563eb',
    Boarding: '#0891b2',
    Payment: '#059669',
    'Follow-up': '#7c3aed',
    Medication: '#d97706',
    'Personal Task': '#475569',
    'Online Consultation': '#2563eb',
    Other: '#64748b'
};

const CALENDAR_VIEWS = [
    { value: Views.MONTH, label: 'Month' },
    { value: Views.WEEK, label: 'Week' },
    { value: Views.DAY, label: 'Day' },
    { value: Views.AGENDA, label: 'Agenda' }
];

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

function isMidnight(date) {
    return date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0;
}

function withTime(date, hours, minutes = 0) {
    const next = new Date(date);
    next.setHours(hours, minutes, 0, 0);
    return next;
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

function addMinutes(date, amount) {
    const next = new Date(date);
    next.setMinutes(next.getMinutes() + amount);
    return next;
}

function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
}

function startOfWeek(date) {
    return startOfDay(addDays(date, -date.getDay()));
}

function endOfWeek(date) {
    return endOfDay(addDays(startOfWeek(date), 6));
}

function calendarRange(monthDate) {
    const firstDay = startOfMonth(monthDate);
    const lastDay = endOfMonth(monthDate);
    const start = addDays(firstDay, -firstDay.getDay());
    const end = addDays(lastDay, 6 - lastDay.getDay());

    return { start, end };
}

function visibleCalendarRange(date, view) {
    if (view === Views.WEEK) {
        return { start: startOfWeek(date), end: endOfWeek(date) };
    }

    if (view === Views.DAY) {
        return { start: startOfDay(date), end: endOfDay(date) };
    }

    if (view === Views.AGENDA) {
        return { start: startOfDay(date), end: endOfDay(addDays(date, 30)) };
    }

    return calendarRange(date);
}

function calendarTitle(date, view) {
    if (view === Views.WEEK) {
        return `${format(startOfWeek(date), 'PPP')} - ${format(endOfWeek(date), 'PPP')}`;
    }

    if (view === Views.DAY) {
        return format(date, 'PPPP');
    }

    if (view === Views.AGENDA) {
        return 'Upcoming Schedule';
    }

    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function combineDateTime(dateValue, timeValue) {
    if (!dateValue) return '';
    return `${dateValue} ${timeValue || '09:00'}:00`;
}

function rangeForm(startDate, endDate = null) {
    const start = startDate || new Date();
    const end = endDate && endDate > start ? endDate : addMinutes(start, 45);

    return {
        title: '',
        details: '',
        category: 'Personal Task',
        date: dateInputValue(start),
        time: timeInputValue(start),
        endDate: dateInputValue(end),
        endTime: timeInputValue(end)
    };
}

function normalizeSlotRange(slot, view, fallbackDate = new Date()) {
    const rawStart = slot?.start instanceof Date ? slot.start : fallbackDate;
    const rawEnd = slot?.end instanceof Date ? slot.end : null;
    const selectedSlots = Array.isArray(slot?.slots) ? slot.slots : [];
    const selectedDates = selectedSlots.filter(value => value instanceof Date);
    const isMonthRange = view === Views.MONTH;

    if (isMonthRange && isMidnight(rawStart)) {
        const start = withTime(rawStart, 9);

        if (selectedDates.length > 1) {
            const lastSelectedDate = selectedDates[selectedDates.length - 1];
            return { start, end: withTime(lastSelectedDate, 17) };
        }

        return { start, end: addMinutes(start, 45) };
    }

    const start = isMidnight(rawStart) ? withTime(rawStart, 9) : rawStart;
    const end = rawEnd && rawEnd > start ? rawEnd : addMinutes(start, 45);

    return { start, end };
}

function displayTimeRange(startValue, endValue) {
    const start = parseTaskDate(startValue);
    const end = parseTaskDate(endValue);

    if (!start) return '';
    if (!end || end <= start) return format(start, 'p');
    if (dateInputValue(start) === dateInputValue(end)) {
        return `${format(start, 'p')} - ${format(end, 'p')}`;
    }

    return `${format(start, 'MMM d, p')} - ${format(end, 'MMM d, p')}`;
}

function displayTaskSchedule(task) {
    const start = parseTaskDate(task.startAt);
    const end = parseTaskDate(task.endAt);

    if (!start) return 'Not scheduled';
    if (!end || end <= start) return `${format(start, 'PPP')} at ${format(start, 'p')}`;
    if (dateInputValue(start) === dateInputValue(end)) {
        return `${format(start, 'PPP')} from ${format(start, 'p')} to ${format(end, 'p')}`;
    }

    return `${format(start, 'PPP p')} - ${format(end, 'PPP p')}`;
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
    const start = isMidnight(date) ? withTime(date, 9) : date;
    return rangeForm(start, addMinutes(start, 45));
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
    const [calendarDate, setCalendarDate] = useState(() => new Date());
    const [calendarView, setCalendarView] = useState(Views.MONTH);
    const [selectedDate, setSelectedDate] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [editingTask, setEditingTask] = useState(null);
    const [form, setForm] = useState(() => emptyForm(new Date()));

    const range = useMemo(() => visibleCalendarRange(calendarDate, calendarView), [calendarDate, calendarView]);

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

    const calendarEvents = useMemo(() => (
        tasks
            .map(task => {
                const start = parseTaskDate(task.startAt);
                if (!start) return null;
                const savedEnd = parseTaskDate(task.endAt);
                const end = savedEnd && savedEnd > start ? savedEnd : addMinutes(start, 45);

                return {
                    id: task.id,
                    title: task.title || 'Task',
                    start,
                    end,
                    resource: task
                };
            })
            .filter(Boolean)
    ), [tasks]);

    const openDay = (date) => {
        const { start, end } = normalizeSlotRange({ start: date }, calendarView, calendarDate);
        setSelectedDate(start);
        setEditingTask(null);
        setForm(rangeForm(start, end));
        setIsDialogOpen(true);
    };

    const openEdit = (task) => {
        const date = parseTaskDate(task.startAt) || new Date();
        setSelectedDate(date);
        setEditingTask(task);
        setForm({
            title: task.title || '',
            details: task.details || '',
            category: task.category || 'Personal Task',
            date: dateInputValue(date),
            time: timeInputValue(date),
            endDate: dateInputValue(parseTaskDate(task.endAt) || addMinutes(date, 45)),
            endTime: timeInputValue(parseTaskDate(task.endAt) || addMinutes(date, 45))
        });
        setIsDialogOpen(true);
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

        const startAt = combineDateTime(form.date, form.time);
        const endAt = combineDateTime(form.endDate || form.date, form.endTime || form.time);
        const startDate = parseTaskDate(startAt);
        const endDate = parseTaskDate(endAt);

        if (endDate && startDate && endDate <= startDate) {
            toast.error('End time must be after the start time.');
            return;
        }

        const payload = {
            title: form.title.trim(),
            details: form.details.trim(),
            category: form.category,
            startAt,
            endAt: endDate ? endAt : null
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

    const navigateCalendar = (action) => {
        if (action === 'TODAY') {
            const today = new Date();
            setCalendarDate(today);
            setSelectedDate(today);
            return;
        }

        const direction = action === 'PREV' ? -1 : 1;
        setCalendarDate(current => {
            if (calendarView === Views.MONTH || calendarView === Views.AGENDA) {
                return new Date(current.getFullYear(), current.getMonth() + direction, 1);
            }

            if (calendarView === Views.WEEK) {
                return addDays(current, direction * 7);
            }

            return addDays(current, direction);
        });
    };

    const openTaskPet = (task) => {
        const path = petProfilePath(task);
        if (path) {
            navigate(path);
        }
    };

    const handleSelectEvent = (event) => {
        const task = event.resource;
        const date = parseTaskDate(task.startAt) || event.start || new Date();

        if (task.editable) {
            openEdit(task);
            return;
        }

        openDay(date);
    };

    const handleSelectSlot = (slot) => {
        const { start, end } = normalizeSlotRange(slot, calendarView, calendarDate || new Date());
        setSelectedDate(start);
        setEditingTask(null);
        setForm(rangeForm(start, end));
        setIsDialogOpen(true);
    };

    const handleViewChange = (view) => {
        setCalendarView(view);
    };

    const eventPropGetter = (event) => {
        const task = event.resource;
        const color = CATEGORY_COLORS[task.category] || CATEGORY_COLORS[task.source === 'personal' ? 'Personal Task' : 'Other'];

        return {
            style: {
                backgroundColor: color,
                borderColor: color,
                color: '#ffffff',
                opacity: isTaskDone(task) ? 0.68 : 1
            }
        };
    };

    const dayPropGetter = (date) => {
        if (selectedDate && dateInputValue(date) === dateInputValue(selectedDate)) {
            return { className: 'todo-calendar-selected-day' };
        }

        return {};
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
                </div>
            </div>

            {loadError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                    {loadError}
                </div>
            )}

            <Card className="overflow-hidden rounded-lg border-slate-200 bg-white shadow-sm">
                <CardHeader className="border-b border-slate-100">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-lg font-black text-slate-950">
                                <CalendarDays className="size-5 text-[#155dfc]" />
                                {calendarTitle(calendarDate, calendarView)}
                            </CardTitle>
                            <p className="mt-1 text-sm font-semibold text-slate-500">
                                Personal tasks and clinic schedule in one timeline.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                            <div className="grid grid-cols-4 rounded-lg border border-slate-200 bg-slate-50 p-1">
                                {CALENDAR_VIEWS.map(option => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => handleViewChange(option.value)}
                                        className={`h-9 rounded-md px-3 text-xs font-black transition ${calendarView === option.value ? 'bg-white text-[#155dfc] shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => navigateCalendar('PREV')} aria-label="Previous period">
                                    <ChevronLeft className="size-4" />
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => navigateCalendar('TODAY')}>
                                    Today
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => navigateCalendar('NEXT')} aria-label="Next period">
                                    <ChevronRight className="size-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                </CardHeader>
                <CardContent className="p-0">
                    <div className="todo-calendar-shell">
                        {isLoading && tasks.length === 0 ? (
                            <div className="flex min-h-[34rem] items-center justify-center gap-2 text-sm font-semibold text-slate-500">
                                <Loader2 className="size-4 animate-spin" />
                                Loading schedules...
                            </div>
                        ) : (
                            <Calendar
                                localizer={calendarLocalizer}
                                events={calendarEvents}
                                date={calendarDate}
                                view={calendarView}
                                views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
                                toolbar={false}
                                selectable="ignoreEvents"
                                popup
                                showMultiDayTimes
                                longPressThreshold={180}
                                step={30}
                                timeslots={2}
                                onNavigate={setCalendarDate}
                                onView={handleViewChange}
                                onSelectEvent={handleSelectEvent}
                                onSelectSlot={handleSelectSlot}
                                eventPropGetter={eventPropGetter}
                                dayPropGetter={dayPropGetter}
                                components={{ event: CalendarEvent }}
                                className="todo-rbc"
                            />
                        )}
                    </div>

                </CardContent>
            </Card>

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
                                        <Label htmlFor="todo-date">Start Date</Label>
                                        <Input
                                            id="todo-date"
                                            type="date"
                                            value={form.date}
                                            onChange={(event) => setForm(current => ({ ...current, date: event.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="todo-time">Start Time</Label>
                                        <Input
                                            id="todo-time"
                                            type="time"
                                            value={form.time}
                                            onChange={(event) => setForm(current => {
                                                const nextTime = event.target.value;
                                                const startAt = parseTaskDate(combineDateTime(current.date, nextTime));
                                                const endAt = parseTaskDate(combineDateTime(current.endDate || current.date, current.endTime));

                                                if (startAt && (!endAt || endAt <= startAt)) {
                                                    const nextEnd = addMinutes(startAt, 45);
                                                    return { ...current, time: nextTime, endDate: dateInputValue(nextEnd), endTime: timeInputValue(nextEnd) };
                                                }

                                                return { ...current, time: nextTime };
                                            })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="todo-end-date">End Date</Label>
                                        <Input
                                            id="todo-end-date"
                                            type="date"
                                            value={form.endDate || form.date}
                                            min={form.date || undefined}
                                            onChange={(event) => setForm(current => ({ ...current, endDate: event.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="todo-end-time">End Time</Label>
                                        <Input
                                            id="todo-end-time"
                                            type="time"
                                            value={form.endTime || form.time}
                                            onChange={(event) => setForm(current => ({ ...current, endTime: event.target.value }))}
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

function CalendarEvent({ event }) {
    const task = event.resource;

    return (
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-black leading-4">
            <span className="truncate">
                {displayTimeRange(task.startAt, task.endAt)} {event.title}
            </span>
            {isTaskDone(task) && <span className="shrink-0 rounded bg-white/20 px-1">Done</span>}
        </span>
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
                        {displayTaskSchedule(task)}{task.petName ? ` - ${task.petName}` : ''}
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
