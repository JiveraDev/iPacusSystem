import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Badge } from "../../ui/badge";
import { format, isSameDay } from "../../lib/date";
import { Calendar, Trash2 } from "lucide-react";
import { toast } from "./toast";

export default function Todos() {
  const [todos, setTodos] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [newTask, setNewTask] = useState({
    title: "",
    details: "",
    category: "Personal Task",
  });

  // Helper function to get category color
  const getCategoryColor = (category) => {
    const colors = {
      'General Check-up': { bg: 'bg-blue-500', text: 'text-blue-700', badge: 'bg-blue-100' },
      'Parasite Control': { bg: 'bg-orange-500', text: 'text-orange-700', badge: 'bg-orange-100' },
      'Surgery': { bg: 'bg-red-600', text: 'text-red-700', badge: 'bg-red-100' },
      'Vaccination': { bg: 'bg-green-600', text: 'text-green-700', badge: 'bg-green-100' },
      'Grooming': { bg: 'bg-pink-500', text: 'text-pink-700', badge: 'bg-pink-100' },
      'Dental Check-up': { bg: 'bg-cyan-600', text: 'text-cyan-700', badge: 'bg-cyan-100' },
      'Personal Task': { bg: 'bg-gray-500', text: 'text-gray-700', badge: 'bg-gray-100' },
      // Legacy categories
      'Medication': { bg: 'bg-blue-600', text: 'text-blue-700', badge: 'bg-blue-100' },
      'Consultation': { bg: 'bg-yellow-500', text: 'text-yellow-700', badge: 'bg-yellow-100' },
      'Follow-up': { bg: 'bg-green-600', text: 'text-green-700', badge: 'bg-green-100' },
      'General': { bg: 'bg-purple-600', text: 'text-purple-700', badge: 'bg-purple-100' },
    };
    return colors[category] || colors['General'];
  };

  useEffect(() => {
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const user = users.find((u) => u.id === currentUser.id);

    if (user && user.todos && user.todos.length > 0) {
      // Convert date strings back to Date objects
      const todosWithDates = user.todos.map((todo) => ({
        ...todo,
        start: new Date(todo.start),
        end: new Date(todo.end),
      }));
      setTodos(todosWithDates);
    } else {
      // Add sample todos for demonstration
      const sampleTodos = [
        // March 2026 - Week 1
        {
          id: "1",
          title: "Rabies Vaccine Follow-up",
          details: "Check for any adverse reactions after vaccination",
          start: new Date(2026, 2, 2, 10, 0),
          end: new Date(2026, 2, 2, 10, 30),
          category: "Follow-up",
        },
        {
          id: "2",
          title: "Morning Medication - Antibiotics",
          details: "Amoxicillin 250mg for Max",
          start: new Date(2026, 2, 3, 8, 0),
          end: new Date(2026, 2, 3, 8, 30),
          category: "Medication",
        },
        {
          id: "3",
          title: "Evening Medication - Antibiotics",
          details: "Amoxicillin 250mg for Max",
          start: new Date(2026, 2, 3, 20, 0),
          end: new Date(2026, 2, 3, 20, 30),
          category: "Medication",
        },
        {
          id: "4",
          title: "General Health Consultation",
          details: "Annual wellness check for Bella with Dr. Smith",
          start: new Date(2026, 2, 5, 14, 0),
          end: new Date(2026, 2, 5, 15, 0),
          category: "Consultation",
        },
        {
          id: "5",
          title: "Heart Medication",
          details: "Enalapril 5mg for senior dog",
          start: new Date(2026, 2, 6, 9, 0),
          end: new Date(2026, 2, 6, 9, 30),
          category: "Medication",
        },

        // March 2026 - Week 2
        {
          id: "6",
          title: "Post-Surgery Follow-up",
          details: "Check surgical site healing and remove stitches",
          start: new Date(2026, 2, 9, 11, 0),
          end: new Date(2026, 2, 9, 12, 0),
          category: "Follow-up",
        },
        {
          id: "7",
          title: "Morning Medication - Pain Relief",
          details: "Carprofen 50mg for Charlie",
          start: new Date(2026, 2, 10, 7, 30),
          end: new Date(2026, 2, 10, 8, 0),
          category: "Medication",
        },
        {
          id: "8",
          title: "Dermatology Consultation",
          details: "Skin allergy consultation with specialist",
          start: new Date(2026, 2, 11, 15, 30),
          end: new Date(2026, 2, 11, 16, 30),
          category: "Consultation",
        },
        {
          id: "9",
          title: "Allergy Medication",
          details: "Antihistamine for skin condition",
          start: new Date(2026, 2, 12, 8, 0),
          end: new Date(2026, 2, 12, 8, 30),
          category: "Medication",
        },
        {
          id: "10",
          title: "Blood Work Follow-up",
          details: "Review lab results with Dr. Johnson",
          start: new Date(2026, 2, 13, 10, 30),
          end: new Date(2026, 2, 13, 11, 0),
          category: "Follow-up",
        },

        // March 2026 - Week 3
        {
          id: "11",
          title: "Thyroid Medication",
          details: "Levothyroxine for Lucy",
          start: new Date(2026, 2, 16, 9, 0),
          end: new Date(2026, 2, 16, 9, 30),
          category: "Medication",
        },
        {
          id: "12",
          title: "Behavioral Consultation",
          details: "Discuss anxiety issues and treatment options",
          start: new Date(2026, 2, 17, 13, 0),
          end: new Date(2026, 2, 17, 14, 0),
          category: "Consultation",
        },
        {
          id: "13",
          title: "Dental Cleaning Follow-up",
          details: "Check gums after dental procedure",
          start: new Date(2026, 2, 18, 16, 0),
          end: new Date(2026, 2, 18, 16, 30),
          category: "Follow-up",
        },
        {
          id: "14",
          title: "Arthritis Medication",
          details: "Glucosamine supplement for joint health",
          start: new Date(2026, 2, 19, 8, 30),
          end: new Date(2026, 2, 19, 9, 0),
          category: "Medication",
        },
        {
          id: "15",
          title: "Nutrition Consultation",
          details: "Weight management plan with nutritionist",
          start: new Date(2026, 2, 20, 14, 30),
          end: new Date(2026, 2, 20, 15, 30),
          category: "Consultation",
        },

        // March 2026 - Week 4
        {
          id: "16",
          title: "Diabetes Medication - Morning",
          details: "Insulin injection for diabetic cat",
          start: new Date(2026, 2, 23, 7, 0),
          end: new Date(2026, 2, 23, 7, 30),
          category: "Medication",
        },
        {
          id: "17",
          title: "Diabetes Medication - Evening",
          details: "Insulin injection for diabetic cat",
          start: new Date(2026, 2, 23, 19, 0),
          end: new Date(2026, 2, 23, 19, 30),
          category: "Medication",
        },
        {
          id: "18",
          title: "Vaccination Follow-up",
          details: "Second dose of DHPP vaccine",
          start: new Date(2026, 2, 24, 11, 30),
          end: new Date(2026, 2, 24, 12, 0),
          category: "Follow-up",
        },
        {
          id: "19",
          title: "Orthopedic Consultation",
          details: "X-ray review for hip dysplasia",
          start: new Date(2026, 2, 25, 10, 0),
          end: new Date(2026, 2, 25, 11, 0),
          category: "Consultation",
        },
        {
          id: "20",
          title: "Eye Drops Medication",
          details: "Antibiotic eye drops for infection",
          start: new Date(2026, 2, 26, 9, 0),
          end: new Date(2026, 2, 26, 9, 30),
          category: "Medication",
        },
        {
          id: "21",
          title: "Heartworm Prevention",
          details: "Monthly heartworm medication",
          start: new Date(2026, 2, 27, 8, 0),
          end: new Date(2026, 2, 27, 8, 30),
          category: "Medication",
        },

        // March 2026 - Additional clustered dates
        {
          id: "22",
          title: "Pre-Surgery Consultation",
          details: "Discuss spay procedure and pre-op requirements",
          start: new Date(2026, 2, 4, 15, 0),
          end: new Date(2026, 2, 4, 16, 0),
          category: "Consultation",
        },
        {
          id: "23",
          title: "Flea & Tick Prevention",
          details: "Monthly topical treatment",
          start: new Date(2026, 2, 11, 10, 0),
          end: new Date(2026, 2, 11, 10, 30),
          category: "Medication",
        },
        {
          id: "24",
          title: "X-ray Follow-up Review",
          details: "Review healing progress of fractured leg",
          start: new Date(2026, 2, 17, 9, 30),
          end: new Date(2026, 2, 17, 10, 0),
          category: "Follow-up",
        },

        // Daily Medications March 8-14
        {
          id: "25",
          title: "Daily Vitamin Supplement",
          details: "Multivitamin for Buddy",
          start: new Date(2026, 2, 8, 8, 0),
          end: new Date(2026, 2, 8, 8, 30),
          category: "Medication",
        },
        {
          id: "26",
          title: "Probiotic Supplement",
          details: "Digestive health supplement for Bella",
          start: new Date(2026, 2, 9, 8, 0),
          end: new Date(2026, 2, 9, 8, 30),
          category: "Medication",
        },
        {
          id: "27",
          title: "Post-Surgery Follow-up",
          details: "Check surgical site healing",
          start: new Date(2026, 2, 9, 11, 0),
          end: new Date(2026, 2, 9, 11, 30),
          category: "Follow-up",
        },
        {
          id: "28",
          title: "Morning Medication",
          details: "Daily morning medication for Max",
          start: new Date(2026, 2, 10, 7, 30),
          end: new Date(2026, 2, 10, 8, 0),
          category: "Medication",
        },
        {
          id: "29",
          title: "Wound Care Follow-up",
          details: "Check healing progress and change bandage",
          start: new Date(2026, 2, 10, 14, 0),
          end: new Date(2026, 2, 10, 14, 30),
          category: "Follow-up",
        },
        {
          id: "30",
          title: "Dermatology Consultation",
          details: "Skin allergy consultation with specialist",
          start: new Date(2026, 2, 11, 15, 30),
          end: new Date(2026, 2, 11, 16, 30),
          category: "Consultation",
        },
        {
          id: "31",
          title: "Flea & Tick Prevention",
          details: "Monthly topical treatment",
          start: new Date(2026, 2, 11, 10, 0),
          end: new Date(2026, 2, 11, 10, 30),
          category: "Medication",
        },
        {
          id: "32",
          title: "Joint Support Medication",
          details: "Cosequin for Max's joint health",
          start: new Date(2026, 2, 11, 8, 0),
          end: new Date(2026, 2, 11, 8, 30),
          category: "Medication",
        },
        {
          id: "33",
          title: "Allergy Medication",
          details: "Antihistamine for skin condition",
          start: new Date(2026, 2, 12, 8, 0),
          end: new Date(2026, 2, 12, 8, 30),
          category: "Medication",
        },
        {
          id: "34",
          title: "Anti-Inflammatory Medication",
          details: "Meloxicam 1.5mg for Charlie",
          start: new Date(2026, 2, 12, 12, 0),
          end: new Date(2026, 2, 12, 12, 30),
          category: "Medication",
        },
        {
          id: "35",
          title: "Blood Work Follow-up",
          details: "Review lab results with Dr. Johnson",
          start: new Date(2026, 2, 13, 10, 30),
          end: new Date(2026, 2, 13, 11, 0),
          category: "Follow-up",
        },
        {
          id: "36",
          title: "Ear Medication",
          details: "Antibiotic ear drops for infection treatment",
          start: new Date(2026, 2, 13, 8, 0),
          end: new Date(2026, 2, 13, 8, 30),
          category: "Medication",
        },
        {
          id: "37",
          title: "Deworming Medication",
          details: "Panacur oral suspension for Luna",
          start: new Date(2026, 2, 14, 8, 0),
          end: new Date(2026, 2, 14, 8, 30),
          category: "Medication",
        },

        // Consultation on March 16
        {
          id: "38",
          title: "Cardiology Consultation",
          details: "Heart murmur evaluation with specialist Dr. Martinez",
          start: new Date(2026, 2, 16, 14, 0),
          end: new Date(2026, 2, 16, 15, 0),
          category: "Consultation",
        },
      ];
      setTodos(sampleTodos);

      // Save sample todos to localStorage
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      const users = JSON.parse(localStorage.getItem("users") || "[]");
      const userIndex = users.findIndex((u) => u.id === currentUser.id);

      if (userIndex !== -1) {
        users[userIndex].todos = sampleTodos;
        localStorage.setItem("users", JSON.stringify(users));
        localStorage.setItem("currentUser", JSON.stringify(users[userIndex]));
      }
    }
  }, []);

  const handleAddTask = () => {
    if (!newTask.title || !selectedDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    const startDate = new Date(selectedDate);
    startDate.setHours(9, 0, 0);
    const endDate = new Date(startDate);
    endDate.setMinutes(endDate.getMinutes() + 30);

    const task = {
      id: Date.now().toString(),
      title: newTask.title,
      details: newTask.details,
      start: startDate,
      end: endDate,
      category: newTask.category,
    };

    const updatedTodos = [...todos, task];
    setTodos(updatedTodos);

    // Save to localStorage
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const userIndex = users.findIndex((u) => u.id === currentUser.id);

    if (userIndex !== -1) {
      users[userIndex].todos = updatedTodos;
      localStorage.setItem("users", JSON.stringify(users));
      localStorage.setItem("currentUser", JSON.stringify(users[userIndex]));
    }

    toast.success("Task added successfully!");
    setIsDialogOpen(false);
    setNewTask({
      title: "",
      details: "",
      category: "Personal Task",
    });
    setSelectedDate(null);
  };

  const handleDeleteTask = (taskId) => {
    const updatedTodos = todos.filter(t => t.id !== taskId);
    setTodos(updatedTodos);

    // Save to localStorage
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const userIndex = users.findIndex((u) => u.id === currentUser.id);

    if (userIndex !== -1) {
      users[userIndex].todos = updatedTodos;
      localStorage.setItem("users", JSON.stringify(users));
      localStorage.setItem("currentUser", JSON.stringify(users[userIndex]));
    }

    toast.success("Task deleted");
  };

  const eventStyleGetter = (event) => {
    const categoryColors = {
      Medication: { backgroundColor: '#3b82f6', borderColor: '#2563eb' },
      Consultation: { backgroundColor: '#eab308', borderColor: '#ca8a04' },
      'Follow-up': { backgroundColor: '#10b981', borderColor: '#059669' },
      General: { backgroundColor: '#8b5cf6', borderColor: '#7c3aed' },
    };

    const style = categoryColors[event.category] || categoryColors.General;
    return {
      style: {
        ...style,
        borderRadius: '5px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block',
      },
    };
  };

  // Get upcoming tasks (next 7 days)
  const upcomingTasks = todos
    .filter(task => new Date(task.start) >= new Date() && new Date(task.start) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  // Get tasks for selected date
  const getTasksForDate = (date) => {
    return todos.filter(task => isSameDay(new Date(task.start), date));
  };

  const tasksForSelectedDate = selectedDate ? getTasksForDate(selectedDate) : [];

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">TODOs & Schedule</h1>
        </div>
      </div>

      {/* Date Task Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedDate ? format(selectedDate, 'PPPP') : 'Select Date'}
            </DialogTitle>
            <DialogDescription>
              View and manage tasks for this date
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Tasks for this date */}
            <div>
              <h3 className="font-semibold mb-3">Tasks for this day ({tasksForSelectedDate.length})</h3>
              {tasksForSelectedDate.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {tasksForSelectedDate.map((task) => (
                    <div key={task.id} className="flex items-start justify-between p-3 border rounded-lg bg-gray-50">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{task.title}</h4>
                          <Badge className={`${getCategoryColor(task.category).badge} ${getCategoryColor(task.category).text}`}>
                            {task.category}
                          </Badge>
                        </div>
                        {task.details && (
                          <p className="text-sm text-gray-600 mb-1">{task.details}</p>
                        )}
                        <p className="text-sm text-gray-500">
                          {format(new Date(task.start), 'p')}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTask(task.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm mb-4">No tasks scheduled for this day</p>
              )}
            </div>

            {/* Add new task form */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-4">Add New Task</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Task Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Feed pet, Give medication, Walk the dog"
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="details">Details</Label>
                  <Textarea
                    id="details"
                    placeholder="Enter task details"
                    value={newTask.details}
                    onChange={(e) => setNewTask({ ...newTask, details: e.target.value })}
                  />
                </div>
                <Button onClick={handleAddTask} className="w-full">
                  Add Task
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Calendar View */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Calendar View</CardTitle>
          <div className="text-lg font-semibold text-gray-700">March 2026</div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            {/* Calendar Grid */}
            <div className="min-w-[700px]">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-center font-semibold text-gray-700 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar dates */}
              <div className="grid grid-cols-7 gap-2">
                {/* Week 1 - Starting with padding for days before month starts */}
                {/* March 1, 2026 is a Sunday, so no padding needed */}
                {Array.from({ length: 31 }, (_, i) => i + 1).map((date) => {
                  const currentDate = new Date(2026, 2, date);
                  const tasksForDate = todos.filter(task => 
                    isSameDay(new Date(task.start), currentDate)
                  );

                  return (
                    <div
                      key={date}
                      onClick={() => {
                        setSelectedDate(currentDate);
                        setIsDialogOpen(true);
                      }}
                      className="border rounded-lg p-2 min-h-[100px] bg-white hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="font-semibold text-gray-900 mb-2">{date}</div>
                      <div className="space-y-1">
                        {tasksForDate.map((task) => (
                          <div
                            key={task.id}
                            className={`text-xs px-2 py-1 rounded text-white truncate ${getCategoryColor(task.category).bg}`}
                            title={task.title}
                          >
                            {task.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Upcoming Tasks (Next 7 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingTasks.length > 0 ? (
            <div className="space-y-3">
              {upcomingTasks.map((task) => (
                <div key={task.id} className="flex flex-col sm:flex-row sm:items-start sm:justify-between p-4 border rounded-lg hover:bg-gray-50 gap-3 sm:gap-0">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h4 className="font-semibold">{task.title}</h4>
                      <Badge className={
                        task.category === 'Medication' 
                          ? 'bg-blue-100 text-blue-700' 
                          : task.category === 'Consultation'
                          ? 'bg-yellow-100 text-yellow-700'
                          : task.category === 'Follow-up'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-purple-100 text-purple-700'
                      }>
                        {task.category}
                      </Badge>
                    </div>
                    {task.details && (
                      <p className="text-sm text-gray-600 mb-1">{task.details}</p>
                    )}
                    <p className="text-sm text-gray-500">
                      {format(new Date(task.start), 'PPP')} at {format(new Date(task.start), 'p')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteTask(task.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 self-start sm:self-auto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-4">No upcoming tasks</p>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Category Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span className="text-sm">General Check-up</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-500 rounded"></div>
              <span className="text-sm">Parasite Control</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-600 rounded"></div>
              <span className="text-sm">Surgery</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-600 rounded"></div>
              <span className="text-sm">Vaccination</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-pink-500 rounded"></div>
              <span className="text-sm">Grooming</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-cyan-600 rounded"></div>
              <span className="text-sm">Dental Check-up</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-500 rounded"></div>
              <span className="text-sm">Personal Task</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

