import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Plus, Trash2, Edit2, PartyPopper, Clock, X } from "lucide-react";
import { format, differenceInDays, getDay } from "date-fns";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

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

    // Filter out Sundays - they're default holidays
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

  // Filter out Sunday events from display (Sundays are default holidays)
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
                            <Clock className="w-4 h-4 text-primary" />
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
                    backgroundColor: "hsl(var(--destructive))", 
                    color: "hsl(var(--destructive-foreground))",
                    borderRadius: "50%" 
                  },
                  holiday: { 
                    backgroundColor: "hsl(var(--destructive))", 
                    color: "hsl(var(--destructive-foreground))",
                    borderRadius: "50%" 
                  },
                  customSession: { 
                    backgroundColor: "hsl(var(--primary))", 
                    color: "hsl(var(--primary-foreground))",
                    borderRadius: "50%" 
                  },
                }}
                className="mx-auto"
              />
              <div className="flex flex-wrap gap-3 mt-4 justify-center text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  <span>Holiday/Sunday</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span>Custom Sessions</span>
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
                    <Clock className="w-4 h-4 mr-2" />
                    Custom Sessions ({customSessionEvents.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="holidays">
                  {holidays.length === 0 ? (
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
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {holidays.map((event) => (
                          <TableRow key={event.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedEventIds.has(event.id)}
                                onCheckedChange={() => toggleEventSelection(event.id)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge variant="destructive">
                                  {format(new Date(event.event_date), "MMM d, yyyy")}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(event.event_date), "EEEE")}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{event.description || "—"}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(event)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteEvent(event.id)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                <TabsContent value="custom">
                  {customSessionEvents.length === 0 ? (
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
                          <TableHead>Date</TableHead>
                          <TableHead>Sessions</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customSessionEvents.map((event) => (
                          <TableRow key={event.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedEventIds.has(event.id)}
                                onCheckedChange={() => toggleEventSelection(event.id)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge variant="default">
                                  {format(new Date(event.event_date), "MMM d, yyyy")}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(event.event_date), "EEEE")}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{event.custom_sessions} sessions</Badge>
                            </TableCell>
                            <TableCell>{event.description || "—"}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(event)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteEvent(event.id)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AcademicCalendar;
