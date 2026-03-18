import React from "react";
import { useListAttendance, useGetTodayAttendance, useClockIn, useClockOut, getListAttendanceQueryKey, getGetTodayAttendanceQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, LogIn, LogOut, Calendar as CalIcon } from "lucide-react";

export default function Attendance() {
  const queryClient = useQueryClient();
  const { data: records, isLoading } = useListAttendance();
  const { data: today } = useGetTodayAttendance();

  const clockInMut = useClockIn({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
      }
    }
  });

  const clockOutMut = useClockOut({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
      }
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Attendance</h1>
          <p className="text-muted-foreground mt-1">Time tracking and status.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="glass-panel p-8 flex flex-col items-center justify-center text-center">
          <Clock className="w-16 h-16 text-primary mb-4" />
          <h2 className="text-2xl font-display font-bold mb-2">Today's Status</h2>
          
          {today?.clockIn ? (
            <div className="space-y-4 w-full">
              <div className="px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                <p className="text-green-400 font-semibold mb-1">Clocked In</p>
                <p className="text-sm font-mono">{new Date(today.clockIn).toLocaleTimeString()}</p>
              </div>
              
              {today.clockOut ? (
                <div className="px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <p className="text-blue-400 font-semibold mb-1">Clocked Out</p>
                  <p className="text-sm font-mono">{new Date(today.clockOut).toLocaleTimeString()}</p>
                </div>
              ) : (
                <Button 
                  onClick={() => clockOutMut.mutate()} 
                  disabled={clockOutMut.isPending}
                  className="w-full bg-accent hover:bg-accent/90 text-white rounded-xl shadow-lg shadow-accent/20 h-12 text-lg"
                >
                  <LogOut className="w-5 h-5 mr-2" /> Clock Out
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4 w-full">
              <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-muted-foreground">
                Not clocked in yet today.
              </div>
              <Button 
                onClick={() => clockInMut.mutate()} 
                disabled={clockInMut.isPending}
                className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/20 h-12 text-lg"
              >
                <LogIn className="w-5 h-5 mr-2" /> Clock In
              </Button>
            </div>
          )}
        </Card>

        <Card className="glass-panel lg:col-span-2 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-white/5 bg-black/10 flex items-center">
            <CalIcon className="w-5 h-5 mr-3 text-muted-foreground" />
            <h3 className="font-display font-bold text-lg">Recent Team Records</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-black/20 border-b border-white/5">
                <tr>
                  <th className="px-6 py-4 font-medium">Employee</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Clock In</th>
                  <th className="px-6 py-4 font-medium">Clock Out</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {records?.map(rec => (
                  <tr key={rec.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">
                      {rec.user?.firstName} {rec.user?.lastName}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{new Date(rec.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 font-mono">{new Date(rec.clockIn).toLocaleTimeString()}</td>
                    <td className="px-6 py-4 font-mono">{rec.clockOut ? new Date(rec.clockOut).toLocaleTimeString() : '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-sm text-xs font-bold uppercase tracking-wider ${
                        rec.status === 'Present' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {rec.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
