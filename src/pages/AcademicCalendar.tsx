import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Plus, Trash2, Edit2, PartyPopper, Clock } from "lucide-react";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  
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

      // Get HOD's department
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

      // Fetch calendar events
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
    setSelectedDate(new Date());
  };

  const openEditDialog = (event: CalendarEvent) => {
    setEditingEvent(event);
    setSelectedDate(new Date(event.event_date));
    setEventType(event.event_type as "holiday" | "custom_sessions");
    setDescription(event.description || "");
    setCustomSessions(event.custom_sessions || 0);
    setDialogOpen(true);
  };

  const handleSaveEvent = async () => {
    if (!selectedDate) {
      toast.error("Please select a date");
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

      const eventData = {
        department,
        event_date: format(selectedDate, "yyyy-MM-dd"),
        event_type: eventType,
        description: description.trim() || null,
        custom_sessions: eventType === "custom_sessions" ? customSessions : null,
        created_by: user.id,
      };

      if (editingEvent) {
        // Update existing
        const { error } = await supabase
          .from("academic_calendar")
          .update(eventData)
          .eq("id", editingEvent.id);

        if (error) throw error;
        toast.success("Calendar event updated");
      } else {
        // Insert new (upsert to handle same date)
        const { error } = await supabase
          .from("academic_calendar")
          .upsert(eventData, { onConflict: "department,event_date" });

        if (error) throw error;
        toast.success("Calendar event added");
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

  // Get dates with events for calendar highlighting
  const holidayDates = events
    .filter(e => e.event_type === "holiday")
    .map(e => new Date(e.event_date));
  
  const customSessionDates = events
    .filter(e => e.event_type === "custom_sessions")
    .map(e => new Date(e.event_date));

  const holidays = events.filter(e => e.event_type === "holiday");
  const customSessionEvents = events.filter(e => e.event_type === "custom_sessions");

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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-2">
              <CalendarIcon className="h-8 w-8" />
              Academic Calendar
            </h2>
            <p className="text-muted-foreground mt-2">
              Manage holidays and customize session hours for {department}
            </p>
          </div>
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingEvent ? "Edit Event" : "Add Calendar Event"}</DialogTitle>
                <DialogDescription>
                  Mark holidays or set custom session hours for specific days
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <div className="border rounded-md p-3">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      className="mx-auto"
                    />
                  </div>
                  {selectedDate && (
                    <p className="text-sm text-muted-foreground text-center">
                      Selected: {format(selectedDate, "EEEE, MMMM d, yyyy")}
                    </p>
                  )}
                </div>

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
                selected={selectedDate}
                onSelect={setSelectedDate}
                modifiers={{
                  holiday: holidayDates,
                  customSession: customSessionDates,
                }}
                modifiersStyles={{
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
              <div className="flex gap-4 mt-4 justify-center text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  <span>Holiday</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span>Custom</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Events List */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Calendar Events</CardTitle>
              <CardDescription>{events.length} event(s) configured</CardDescription>
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
                      No holidays configured yet
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {holidays.map((event) => (
                          <TableRow key={event.id}>
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
