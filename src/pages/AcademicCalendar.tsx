import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Plus, Trash2, Edit2, PartyPopper, Clock, X, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { format, differenceInDays, getDay, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, getMonth, getYear, startOfYear, addYears } from "date-fns";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import jsPDF from "jspdf";

// Helper to group consecutive dates into ranges
const groupConsecutiveDates = (dates: Date[]): { start: Date; end: Date }[] => {
  if (dates.length === 0) return [];
  
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const ranges: { start: Date; end: Date }[] = [];
  
  let rangeStart = sorted[0];
  let rangeEnd = sorted[0];
  
  for (let i = 1; i < sorted.length; i++) {
    const diff = differenceInDays(sorted[i], rangeEnd);
    if (diff === 1) {
      rangeEnd = sorted[i];
    } else {
      ranges.push({ start: rangeStart, end: rangeEnd });
      rangeStart = sorted[i];
      rangeEnd = sorted[i];
    }
  }
  ranges.push({ start: rangeStart, end: rangeEnd });
  
  return ranges;
};

const formatDateRange = (range: { start: Date; end: Date }): string => {
  if (range.start.getTime() === range.end.getTime()) {
    return format(range.start, "MMM d");
  }
  if (range.start.getMonth() === range.end.getMonth()) {
    return `${format(range.start, "MMM d")} - ${format(range.end, "d")}`;
  }
  return `${format(range.start, "MMM d")} - ${format(range.end, "MMM d")}`;
};

// Check if a date is Sunday
const isSunday = (date: Date): boolean => getDay(date) === 0;

// Minimalist glossy/glassy style classes for calendar markers
const glossyStyles = {
  sunday: "bg-indigo-500/20 text-indigo-400 backdrop-blur-sm border border-indigo-400/30 shadow-sm",
  holiday: "bg-rose-500/20 text-rose-400 backdrop-blur-sm border border-rose-400/30 shadow-sm",
  customSession: "bg-emerald-500/20 text-emerald-400 backdrop-blur-sm border border-emerald-400/30 shadow-sm",
};

// Group events by description and return with date ranges
interface GroupedEvent {
  description: string;
  dates: Date[];
  eventType: "holiday" | "custom_sessions";
  customSessions?: number;
  eventIds: string[];
}

const groupEventsByDescription = (events: CalendarEvent[]): GroupedEvent[] => {
  const groups: { [key: string]: GroupedEvent } = {};
  
  events.forEach(event => {
    const key = `${event.event_type}-${event.description || 'No description'}-${event.custom_sessions || 0}`;
    if (!groups[key]) {
      groups[key] = {
        description: event.description || 'No description',
        dates: [],
        eventType: event.event_type as "holiday" | "custom_sessions",
        customSessions: event.custom_sessions || undefined,
        eventIds: [],
      };
    }
    groups[key].dates.push(new Date(event.event_date));
    groups[key].eventIds.push(event.id);
  });
  
  return Object.values(groups).sort((a, b) => {
    const aMin = Math.min(...a.dates.map(d => d.getTime()));
    const bMin = Math.min(...b.dates.map(d => d.getTime()));
    return bMin - aMin;
  });
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarEvent {
  id: string;
  department: string;
  event_date: string;
  event_type: "holiday" | "custom_sessions";
  description: string | null;
  custom_sessions: number | null;
  created_at: string;
}

const AcademicCalendar = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [department, setDepartment] = useState<string>("");
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [selectedDownloadMonths, setSelectedDownloadMonths] = useState<number[]>([]);
  const [downloadYear, setDownloadYear] = useState<number>(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<"overview" | "monthly" | "yearly">("overview");
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  
  // Bulk selection state
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  
  // Form state
  const [eventType, setEventType] = useState<"holiday" | "custom_sessions">("holiday");
  const [description, setDescription] = useState("");
  const [customSessions, setCustomSessions] = useState<number>(0);

  useEffect(() => {
    fetchDepartmentAndEvents();
  }, []);

  const fetchDepartmentAndEvents = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("department")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.department) {
        toast.error("Department not found");
        setLoading(false);
        return;
      }

      setDepartment(profile.department);

      const { data: calendarEvents, error } = await supabase
        .from("academic_calendar")
        .select("*")
        .eq("department", profile.department)
        .order("event_date", { ascending: false });

      if (error) throw error;
      setEvents((calendarEvents || []) as CalendarEvent[]);
    } catch (error: any) {
      console.error("Error fetching calendar:", error);
      toast.error("Failed to load calendar events");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEventType("holiday");
    setDescription("");
    setCustomSessions(0);
    setEditingEvent(null);
    setSelectedDates([]);
  };

  const openEditDialog = (event: CalendarEvent) => {
    setEditingEvent(event);
    setSelectedDates([new Date(event.event_date)]);
    setEventType(event.event_type as "holiday" | "custom_sessions");
    setDescription(event.description || "");
    setCustomSessions(event.custom_sessions || 0);
    setDialogOpen(true);
  };

  const handleSaveEvent = async () => {
    if (selectedDates.length === 0) {
      toast.error("Please select at least one date");
      return;
    }

    const nonSundayDates = selectedDates.filter(d => !isSunday(d));
    if (nonSundayDates.length === 0) {
      toast.error("Sundays are already marked as default holidays");
      return;
    }

    if (eventType === "custom_sessions" && (customSessions < 0 || customSessions > 10)) {
      toast.error("Sessions must be between 0 and 10");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (editingEvent) {
        const eventData = {
          department,
          event_date: format(nonSundayDates[0], "yyyy-MM-dd"),
          event_type: eventType,
          description: description.trim() || null,
          custom_sessions: eventType === "custom_sessions" ? customSessions : null,
          created_by: user.id,
        };
        
        const { error } = await supabase
          .from("academic_calendar")
          .update(eventData)
          .eq("id", editingEvent.id);

        if (error) throw error;
        toast.success("Calendar event updated");
      } else {
        const eventsToInsert = nonSundayDates.map(date => ({
          department,
          event_date: format(date, "yyyy-MM-dd"),
          event_type: eventType,
          description: description.trim() || null,
          custom_sessions: eventType === "custom_sessions" ? customSessions : null,
          created_by: user.id,
        }));

        const { error } = await supabase
          .from("academic_calendar")
          .upsert(eventsToInsert, { onConflict: "department,event_date" });

        if (error) throw error;
        toast.success(`${nonSundayDates.length} calendar event(s) added`);
      }

      setDialogOpen(false);
      resetForm();
      fetchDepartmentAndEvents();
    } catch (error: any) {
      console.error("Error saving event:", error);
      toast.error(error.message || "Failed to save event");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm("Are you sure you want to delete this event?")) return;

    try {
      const { error } = await supabase
        .from("academic_calendar")
        .delete()
        .eq("id", eventId);

      if (error) throw error;
      toast.success("Event deleted");
      fetchDepartmentAndEvents();
    } catch (error: any) {
      console.error("Error deleting event:", error);
      toast.error("Failed to delete event");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedEventIds.size === 0) {
      toast.error("No events selected");
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedEventIds.size} event(s)?`)) return;

    setBulkDeleting(true);
    try {
      const { error } = await supabase
        .from("academic_calendar")
        .delete()
        .in("id", Array.from(selectedEventIds));

      if (error) throw error;
      toast.success(`${selectedEventIds.size} event(s) deleted`);
      setSelectedEventIds(new Set());
      fetchDepartmentAndEvents();
    } catch (error: any) {
      console.error("Error bulk deleting:", error);
      toast.error("Failed to delete events");
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleEventSelection = (eventId: string) => {
    const newSelection = new Set(selectedEventIds);
    if (newSelection.has(eventId)) {
      newSelection.delete(eventId);
    } else {
      newSelection.add(eventId);
    }
    setSelectedEventIds(newSelection);
  };

  const toggleSelectAll = (eventList: CalendarEvent[]) => {
    const allIds = eventList.map(e => e.id);
    const allSelected = allIds.every(id => selectedEventIds.has(id));
    
    const newSelection = new Set(selectedEventIds);
    if (allSelected) {
      allIds.forEach(id => newSelection.delete(id));
    } else {
      allIds.forEach(id => newSelection.add(id));
    }
    setSelectedEventIds(newSelection);
  };

  // Get event for a specific date
  const getEventForDate = (date: Date): CalendarEvent | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    return events.find(e => e.event_date === dateStr) || null;
  };

  // Generate month grid
  const generateMonthGrid = (month: Date) => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const days = eachDayOfInterval({ start, end });
    
    // Add padding days at the start
    const startDay = getDay(start);
    const paddingStart = Array(startDay).fill(null);
    
    return [...paddingStart, ...days];
  };

  // Toggle month selection for download
  const toggleMonthSelection = (month: number) => {
    setSelectedDownloadMonths(prev => {
      if (prev.includes(month)) {
        return prev.filter(m => m !== month);
      }
      return [...prev, month].sort((a, b) => a - b);
    });
  };

  // Download calendar as PDF
  const downloadCalendarPDF = () => {
    if (selectedDownloadMonths.length === 0) {
      toast.error("Please select at least one month");
      return;
    }

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const cellWidth = (pageWidth - margin * 2) / 7;
    const cellHeight = 18;

    selectedDownloadMonths.forEach((month, pageIndex) => {
      if (pageIndex > 0) {
        pdf.addPage();
      }

      const monthDate = new Date(downloadYear, month, 1);
      const monthName = MONTH_NAMES[month];
      
      // Header
      pdf.setFillColor(245, 245, 245);
      pdf.rect(0, 0, pageWidth, 35, "F");
      
      pdf.setFontSize(24);
      pdf.setTextColor(30, 30, 30);
      pdf.text(`${monthName} ${downloadYear}`, pageWidth / 2, 20, { align: "center" });
      
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(department, pageWidth / 2, 28, { align: "center" });

      // Day headers
      let yPos = 45;
      pdf.setFontSize(10);
      pdf.setTextColor(80, 80, 80);
      DAY_NAMES.forEach((day, i) => {
        const xPos = margin + i * cellWidth + cellWidth / 2;
        pdf.text(day, xPos, yPos, { align: "center" });
      });

      // Calendar grid
      yPos = 52;
      const grid = generateMonthGrid(monthDate);
      let row = 0;
      let col = 0;

      grid.forEach((day, index) => {
        const xPos = margin + col * cellWidth;
        const currentY = yPos + row * cellHeight;

        // Cell border
        pdf.setDrawColor(220, 220, 220);
        pdf.rect(xPos, currentY, cellWidth, cellHeight);

        if (day) {
          const event = getEventForDate(day);
          const sunday = isSunday(day);

          // Background color for holidays/Sundays
          if (sunday || (event && event.event_type === "holiday")) {
            pdf.setFillColor(254, 226, 226); // Light red
            pdf.rect(xPos + 0.5, currentY + 0.5, cellWidth - 1, cellHeight - 1, "F");
          } else if (event && event.event_type === "custom_sessions") {
            pdf.setFillColor(254, 249, 195); // Light yellow
            pdf.rect(xPos + 0.5, currentY + 0.5, cellWidth - 1, cellHeight - 1, "F");
          }

          // Day number
          pdf.setFontSize(11);
          pdf.setTextColor(sunday ? 200 : 50, sunday ? 50 : 50, sunday ? 50 : 50);
          pdf.text(format(day, "d"), xPos + 3, currentY + 6);

          // Event description or Sunday label
          if (sunday) {
            pdf.setFontSize(6);
            pdf.setTextColor(180, 50, 50);
            pdf.text("Sunday", xPos + 3, currentY + 11);
          } else if (event) {
            pdf.setFontSize(6);
            if (event.event_type === "holiday") {
              pdf.setTextColor(180, 50, 50);
              pdf.text(event.description || "Holiday", xPos + 3, currentY + 11, { maxWidth: cellWidth - 4 });
            } else {
              pdf.setTextColor(150, 120, 0);
              pdf.text(`${event.custom_sessions} sessions`, xPos + 3, currentY + 11);
              if (event.description) {
                pdf.text(event.description, xPos + 3, currentY + 15, { maxWidth: cellWidth - 4 });
              }
            }
          }
        }

        col++;
        if (col === 7) {
          col = 0;
          row++;
        }
      });

      // Legend
      const legendY = pageHeight - 25;
      pdf.setFontSize(8);
      
      pdf.setFillColor(254, 226, 226);
      pdf.rect(margin, legendY, 8, 5, "F");
      pdf.setTextColor(80, 80, 80);
      pdf.text("Holiday / Sunday", margin + 10, legendY + 4);

      pdf.setFillColor(254, 249, 195);
      pdf.rect(margin + 50, legendY, 8, 5, "F");
      pdf.text("Custom Sessions", margin + 60, legendY + 4);

      // Footer
      pdf.setFontSize(7);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Generated on ${format(new Date(), "PPP")}`, pageWidth / 2, pageHeight - 10, { align: "center" });
    });

    pdf.save(`Academic_Calendar_${downloadYear}_${department}.pdf`);
    toast.success("Calendar downloaded successfully");
    setDownloadDialogOpen(false);
    setSelectedDownloadMonths([]);
  };

  // Filter out Sunday events from display
  const nonSundayEvents = events.filter(e => {
    const eventDate = new Date(e.event_date);
    return !isSunday(eventDate);
  });

  const holidayDates = nonSundayEvents
    .filter(e => e.event_type === "holiday")
    .map(e => new Date(e.event_date));
  
  const customSessionDates = nonSundayEvents
    .filter(e => e.event_type === "custom_sessions")
    .map(e => new Date(e.event_date));

  const holidays = nonSundayEvents.filter(e => e.event_type === "holiday");
  const customSessionEvents = nonSundayEvents.filter(e => e.event_type === "custom_sessions");

  // Grouped events for table display
  const groupedHolidays = groupEventsByDescription(holidays);
  const groupedCustomSessions = groupEventsByDescription(customSessionEvents);

  // Render a single month calendar for the view
  const renderMonthCalendar = (monthDate: Date, size: "small" | "large" = "large") => {
    const grid = generateMonthGrid(monthDate);
    const cellSize = size === "large" ? "h-16 w-full" : "h-10 w-10";
    const fontSize = size === "large" ? "text-sm" : "text-xs";
    
    return (
      <div className={size === "large" ? "w-full" : ""}>
        <div className="text-center font-semibold mb-2">
          {format(monthDate, "MMMM yyyy")}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {DAY_NAMES.map(day => (
            <div key={day} className={`text-center ${fontSize} font-medium text-muted-foreground p-1`}>
              {size === "large" ? day : day.charAt(0)}
            </div>
          ))}
          {grid.map((day, i) => {
            if (!day) {
              return <div key={`empty-${i}`} className={cellSize} />;
            }
            
            const event = getEventForDate(day);
            const sunday = isSunday(day);
            const isHoliday = sunday || (event && event.event_type === "holiday");
            const isCustomSession = event && event.event_type === "custom_sessions";
            
            // Determine the style class based on event type
            let cellClass = "bg-background border-border";
            if (sunday) {
              cellClass = glossyStyles.sunday;
            } else if (event && event.event_type === "holiday") {
              cellClass = glossyStyles.holiday;
            } else if (isCustomSession) {
              cellClass = glossyStyles.customSession;
            }
            
            return (
              <div
                key={day.toISOString()}
                className={`${cellSize} rounded-lg p-1 ${fontSize} ${cellClass} transition-all duration-200`}
              >
                <div className="font-medium">{format(day, "d")}</div>
                {size === "large" && (
                  <div className="text-[10px] truncate opacity-90">
                    {sunday && "Sunday"}
                    {!sunday && event?.description}
                    {!sunday && isCustomSession && !event?.description && `${event.custom_sessions}s`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 w-full">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-2">
              <CalendarIcon className="h-8 w-8" />
              Academic Calendar
            </h2>
            <p className="text-muted-foreground mt-2">
              Manage holidays and customize session hours for {department}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Download Dialog */}
            <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Download Calendar</DialogTitle>
                  <DialogDescription>
                    Select months to download as PDF (one month per page)
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div className="space-y-2">
                    <Label>Year</Label>
                    <Select value={downloadYear.toString()} onValueChange={(v) => setDownloadYear(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[downloadYear - 1, downloadYear, downloadYear + 1].map(year => (
                          <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Select Months</Label>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setSelectedDownloadMonths(selectedDownloadMonths.length === 12 ? [] : [0,1,2,3,4,5,6,7,8,9,10,11])}
                        className="h-7 text-xs"
                      >
                        {selectedDownloadMonths.length === 12 ? "Clear All" : "Select All"}
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {MONTH_NAMES.map((month, index) => (
                        <div
                          key={month}
                          onClick={() => toggleMonthSelection(index)}
                          className={`p-2 text-sm text-center rounded-md cursor-pointer border transition-colors ${
                            selectedDownloadMonths.includes(index)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background hover:bg-muted border-border"
                          }`}
                        >
                          {month.slice(0, 3)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDownloadDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={downloadCalendarPDF} disabled={selectedDownloadMonths.length === 0}>
                    <Download className="w-4 h-4 mr-2" />
                    Download ({selectedDownloadMonths.length})
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Add Event Dialog */}
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Event
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>{editingEvent ? "Edit Event" : "Add Calendar Event"}</DialogTitle>
                  <DialogDescription>
                    Mark holidays or set custom session hours. Sundays are default holidays.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                  {/* Left side - Calendar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{editingEvent ? "Date" : "Select Date(s)"}</Label>
                      {!editingEvent && selectedDates.length > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setSelectedDates([])}
                          className="h-7 px-2 text-xs"
                        >
                          <X className="w-3 h-3 mr-1" />
                          Clear All
                        </Button>
                      )}
                    </div>
                    <div className="border rounded-md p-3">
                      {editingEvent ? (
                        <Calendar
                          mode="single"
                          selected={selectedDates[0]}
                          onSelect={(date) => setSelectedDates(date ? [date] : [])}
                          className="mx-auto pointer-events-auto"
                          modifiers={{
                            sunday: (date) => isSunday(date),
                          }}
                          modifiersStyles={{
                            sunday: { 
                              backgroundColor: "hsl(var(--destructive))", 
                              color: "hsl(var(--destructive-foreground))",
                              borderRadius: "50%" 
                            },
                          }}
                          disabled={(date) => isSunday(date)}
                        />
                      ) : (
                        <Calendar
                          mode="multiple"
                          selected={selectedDates}
                          onSelect={(dates) => setSelectedDates(dates || [])}
                          className="mx-auto pointer-events-auto"
                          modifiers={{
                            sunday: (date) => isSunday(date),
                          }}
                          modifiersStyles={{
                            sunday: { 
                              backgroundColor: "hsl(var(--destructive))", 
                              color: "hsl(var(--destructive-foreground))",
                              borderRadius: "50%" 
                            },
                          }}
                          disabled={(date) => isSunday(date)}
                        />
                      )}
                    </div>
                    {selectedDates.length > 0 && (
                      <div className="text-sm text-muted-foreground text-center">
                        {editingEvent 
                          ? `Selected: ${format(selectedDates[0], "EEEE, MMMM d, yyyy")}`
                          : (
                            <div className="space-y-1">
                              <p className="font-medium">{selectedDates.length} date(s) selected</p>
                              <div className="flex flex-wrap gap-1 justify-center max-h-16 overflow-auto">
                                {groupConsecutiveDates(selectedDates).map((range, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {formatDateRange(range)}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )
                        }
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground text-center">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-destructive" />
                        Sundays = Default holidays (no attendance)
                      </span>
                    </p>
                  </div>

                  {/* Right side - Form fields */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Event Type</Label>
                      <Select value={eventType} onValueChange={(v) => setEventType(v as "holiday" | "custom_sessions")}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="holiday">
                            <span className="flex items-center gap-2">
                              <PartyPopper className="w-4 h-4 text-destructive" />
                              Holiday (No attendance)
                            </span>
                          </SelectItem>
                          <SelectItem value="custom_sessions">
                            <span className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-amber-500" />
                              Custom Sessions
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {eventType === "custom_sessions" && (
                      <div className="space-y-2">
                        <Label>Number of Sessions</Label>
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          value={customSessions}
                          onChange={(e) => setCustomSessions(parseInt(e.target.value) || 0)}
                          placeholder="Enter sessions (0-10)"
                        />
                        <p className="text-xs text-muted-foreground">
                          Override the default sessions for this day (0-10)
                        </p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Description (Optional)</Label>
                      <Input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={eventType === "holiday" ? "e.g., Diwali, Christmas" : "e.g., Half-day, Special event"}
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveEvent} disabled={saving}>
                    {saving ? "Saving..." : editingEvent ? "Update" : "Add Event"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* View Mode Tabs */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="monthly">Monthly View</TabsTrigger>
            <TabsTrigger value="yearly">Yearly View</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Calendar Preview */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-lg">Calendar Overview</CardTitle>
                  <CardDescription>Holidays and custom sessions</CardDescription>
                </CardHeader>
                <CardContent>
                  <Calendar
                    mode="single"
                    selected={undefined}
                    onSelect={() => {}}
                    modifiers={{
                      sunday: (date) => isSunday(date),
                      holiday: holidayDates,
                      customSession: customSessionDates,
                    }}
                    modifiersStyles={{
                      sunday: { 
                        background: "rgba(99, 102, 241, 0.15)",
                        color: "rgb(129, 140, 248)",
                        borderRadius: "6px",
                        border: "1px solid rgba(99, 102, 241, 0.3)"
                      },
                      holiday: { 
                        background: "rgba(244, 63, 94, 0.15)",
                        color: "rgb(251, 113, 133)",
                        borderRadius: "6px",
                        border: "1px solid rgba(244, 63, 94, 0.3)"
                      },
                      customSession: { 
                        background: "rgba(16, 185, 129, 0.15)",
                        color: "rgb(52, 211, 153)",
                        borderRadius: "6px",
                        border: "1px solid rgba(16, 185, 129, 0.3)"
                      },
                    }}
                    className="mx-auto"
                  />
                  <div className="flex flex-wrap gap-4 mt-4 justify-center text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-indigo-500/20 border border-indigo-400/30" />
                      <span className="text-muted-foreground">Sunday</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-rose-500/20 border border-rose-400/30" />
                      <span className="text-muted-foreground">Holiday</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-400/30" />
                      <span className="text-muted-foreground">Custom Sessions</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Events List */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Calendar Events</CardTitle>
                      <CardDescription>
                        {nonSundayEvents.length} event(s) configured (Sundays excluded)
                      </CardDescription>
                    </div>
                    {selectedEventIds.size > 0 && (
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={handleBulkDelete}
                        disabled={bulkDeleting}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {bulkDeleting ? "Deleting..." : `Delete (${selectedEventIds.size})`}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="holidays">
                    <TabsList className="mb-4">
                      <TabsTrigger value="holidays">
                        <PartyPopper className="w-4 h-4 mr-2" />
                        Holidays ({holidays.length})
                      </TabsTrigger>
                      <TabsTrigger value="custom">
                        <Clock className="w-4 h-4 mr-2 text-amber-500" />
                        Custom Sessions ({customSessionEvents.length})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="holidays">
                      {groupedHolidays.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>No additional holidays configured</p>
                          <p className="text-xs mt-1">Sundays are automatically marked as holidays</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10">
                                <Checkbox
                                  checked={holidays.length > 0 && holidays.every(h => selectedEventIds.has(h.id))}
                                  onCheckedChange={() => toggleSelectAll(holidays)}
                                />
                              </TableHead>
                              <TableHead>Date Range</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead>Count</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {groupedHolidays.map((group, idx) => {
                              const ranges = groupConsecutiveDates(group.dates);
                              const allSelected = group.eventIds.every(id => selectedEventIds.has(id));
                              const firstEvent = holidays.find(h => h.id === group.eventIds[0]);
                              return (
                                <TableRow key={idx}>
                                  <TableCell>
                                    <Checkbox
                                      checked={allSelected}
                                      onCheckedChange={() => {
                                        const newSelection = new Set(selectedEventIds);
                                        if (allSelected) {
                                          group.eventIds.forEach(id => newSelection.delete(id));
                                        } else {
                                          group.eventIds.forEach(id => newSelection.add(id));
                                        }
                                        setSelectedEventIds(newSelection);
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                      {ranges.map((range, i) => (
                                        <Badge 
                                          key={i} 
                                          className="bg-gradient-to-r from-rose-400 to-rose-600 text-white shadow-sm shadow-rose-500/30 border-0"
                                        >
                                          {formatDateRange(range)}
                                        </Badge>
                                      ))}
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-medium">{group.description}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="border-rose-300 text-rose-600">
                                      {group.dates.length} day(s)
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                      {firstEvent && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => openEditDialog(firstEvent)}
                                        >
                                          <Edit2 className="w-4 h-4" />
                                        </Button>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={async () => {
                                          if (!confirm(`Delete ${group.dates.length} holiday(s)?`)) return;
                                          try {
                                            const { error } = await supabase
                                              .from("academic_calendar")
                                              .delete()
                                              .in("id", group.eventIds);
                                            if (error) throw error;
                                            toast.success(`${group.dates.length} holiday(s) deleted`);
                                            fetchDepartmentAndEvents();
                                          } catch (error: any) {
                                            toast.error("Failed to delete");
                                          }
                                        }}
                                      >
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </TabsContent>

                    <TabsContent value="custom">
                      {groupedCustomSessions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No custom sessions configured yet
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10">
                                <Checkbox
                                  checked={customSessionEvents.length > 0 && customSessionEvents.every(e => selectedEventIds.has(e.id))}
                                  onCheckedChange={() => toggleSelectAll(customSessionEvents)}
                                />
                              </TableHead>
                              <TableHead>Date Range</TableHead>
                              <TableHead>Sessions</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead>Count</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {groupedCustomSessions.map((group, idx) => {
                              const ranges = groupConsecutiveDates(group.dates);
                              const allSelected = group.eventIds.every(id => selectedEventIds.has(id));
                              const firstEvent = customSessionEvents.find(e => e.id === group.eventIds[0]);
                              return (
                                <TableRow key={idx}>
                                  <TableCell>
                                    <Checkbox
                                      checked={allSelected}
                                      onCheckedChange={() => {
                                        const newSelection = new Set(selectedEventIds);
                                        if (allSelected) {
                                          group.eventIds.forEach(id => newSelection.delete(id));
                                        } else {
                                          group.eventIds.forEach(id => newSelection.add(id));
                                        }
                                        setSelectedEventIds(newSelection);
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                      {ranges.map((range, i) => (
                                        <Badge 
                                          key={i} 
                                          className="bg-gradient-to-r from-emerald-400 to-emerald-600 text-white shadow-sm shadow-emerald-500/30 border-0"
                                        >
                                          {formatDateRange(range)}
                                        </Badge>
                                      ))}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="border-emerald-500 text-emerald-600">
                                      {group.customSessions} sessions
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="font-medium">{group.description}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="border-emerald-300 text-emerald-600">
                                      {group.dates.length} day(s)
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                      {firstEvent && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => openEditDialog(firstEvent)}
                                        >
                                          <Edit2 className="w-4 h-4" />
                                        </Button>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={async () => {
                                          if (!confirm(`Delete ${group.dates.length} custom session(s)?`)) return;
                                          try {
                                            const { error } = await supabase
                                              .from("academic_calendar")
                                              .delete()
                                              .in("id", group.eventIds);
                                            if (error) throw error;
                                            toast.success(`${group.dates.length} custom session(s) deleted`);
                                            fetchDepartmentAndEvents();
                                          } catch (error: any) {
                                            toast.error("Failed to delete");
                                          }
                                        }}
                                      >
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Monthly View Tab */}
          <TabsContent value="monthly">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{format(currentMonth, "MMMM yyyy")}</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
                      Today
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {renderMonthCalendar(currentMonth, "large")}
                <div className="flex flex-wrap gap-4 mt-4 justify-center text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-indigo-500/20 border border-indigo-400/30" />
                    <span className="text-muted-foreground">Sunday</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-rose-500/20 border border-rose-400/30" />
                    <span className="text-muted-foreground">Holiday</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-400/30" />
                    <span className="text-muted-foreground">Custom Sessions</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Yearly View Tab */}
          <TabsContent value="yearly">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{currentYear}</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => setCurrentYear(currentYear - 1)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentYear(new Date().getFullYear())}>
                      This Year
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setCurrentYear(currentYear + 1)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {MONTH_NAMES.map((_, index) => (
                    <div key={index} className="border rounded-lg p-3">
                      {renderMonthCalendar(new Date(currentYear, index, 1), "small")}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-4 mt-6 justify-center text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-indigo-500/20 border border-indigo-400/30" />
                    <span className="text-muted-foreground">Sunday</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-rose-500/20 border border-rose-400/30" />
                    <span className="text-muted-foreground">Holiday</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-400/30" />
                    <span className="text-muted-foreground">Custom Sessions</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AcademicCalendar;
