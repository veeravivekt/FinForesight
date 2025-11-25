"use client";

import { useEffect } from "react";
import { ProtectedRoute } from "@/components/protected-route";
import { useAuthStore } from "@/store/auth-store";
import { useNotificationStore } from "@/store/notification-store";
import { connectWebSocket, disconnectWebSocket, getSocket } from "@/lib/websocket";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Wallet, LogOut, LayoutDashboard, CreditCard, Target, TrendingUp, Settings, FileText, Repeat, Receipt, Bell, Bot, TrendingDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Accounts", href: "/accounts", icon: Wallet },
  { name: "Transactions", href: "/transactions", icon: CreditCard },
  { name: "Budgets", href: "/budgets", icon: TrendingUp },
  { name: "Goals", href: "/goals", icon: Target },
  { name: "Cash Flow", href: "/cashflow", icon: TrendingDown },
  { name: "Bills", href: "/bills", icon: Repeat },
  { name: "Receipts", href: "/receipts", icon: Receipt },
  { name: "Reports", href: "/reports", icon: FileText },
  { name: "AI Assistant", href: "/ai-assistant", icon: Bot },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuthStore();
  const { notifications, unreadCount, addNotification, markAsRead, markAllAsRead } = useNotificationStore();
  const pathname = usePathname();

  // Initialize WebSocket connection
  useEffect(() => {
    if (user?.id) {
      const token = localStorage.getItem("accessToken");
      if (token) {
        const socket = connectWebSocket(user.id, token);

        // Listen for transaction events
        socket.on("transaction:created", (data: any) => {
          addNotification({
            type: "transaction",
            event: "created",
            title: "Transaction Created",
            message: `${data.type === "income" ? "Income" : "Expense"} of $${Math.abs(data.amount).toFixed(2)} added`,
            data,
            timestamp: data.timestamp || new Date().toISOString(),
          });
        });

        socket.on("transaction:updated", (data: any) => {
          addNotification({
            type: "transaction",
            event: "updated",
            title: "Transaction Updated",
            message: `Transaction updated: $${Math.abs(data.amount).toFixed(2)}`,
            data,
            timestamp: data.timestamp || new Date().toISOString(),
          });
        });

        socket.on("transaction:deleted", (data: any) => {
          addNotification({
            type: "transaction",
            event: "deleted",
            title: "Transaction Deleted",
            message: `Transaction deleted`,
            data,
            timestamp: data.timestamp || new Date().toISOString(),
          });
        });

        // Listen for budget events
        socket.on("budget:threshold", (data: any) => {
          addNotification({
            type: "budget",
            event: "threshold",
            title: data.isOverBudget ? "Budget Exceeded" : "Budget Alert",
            message: data.message || `Budget alert for ${data.category}`,
            data,
            timestamp: data.timestamp || new Date().toISOString(),
          });
        });

        // Listen for goal events
        socket.on("goal:completed", (data: any) => {
          addNotification({
            type: "goal",
            event: "completed",
            title: "Goal Completed!",
            message: `Congratulations! You've completed your goal: ${data.name}`,
            data,
            timestamp: data.timestamp || new Date().toISOString(),
          });
        });


        return () => {
          disconnectWebSocket();
        };
      }
    }
  }, [user?.id, addNotification]);

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        {/* Sidebar */}
        <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <div className="flex h-full flex-col">
            <div className="flex h-16 items-center border-b border-gray-200 dark:border-gray-700 px-6">
              <h1 className="text-xl font-bold">FinForesight</h1>
            </div>
            <nav className="flex-1 space-y-1 px-3 py-4">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-gray-200 dark:border-gray-700 p-4">
              <div className="mb-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                {user?.name}
              </div>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  logout();
                  window.location.href = "/login";
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-6">
            {/* Notification Bell */}
            <div className="fixed top-4 right-4 z-50">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={markAllAsRead}
                        className="h-6 text-xs"
                      >
                        Mark all read
                      </Button>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">
                      No notifications
                    </div>
                  ) : (
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.slice(0, 10).map((notification) => (
                        <DropdownMenuItem
                          key={notification.id}
                          className={`flex flex-col items-start p-3 cursor-pointer ${
                            !notification.read ? "bg-blue-50 dark:bg-blue-900/20" : ""
                          }`}
                          onClick={() => markAsRead(notification.id)}
                        >
                          <div className="flex items-start justify-between w-full">
                            <div className="flex-1">
                              <p className="font-semibold text-sm">{notification.title}</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                {new Date(notification.timestamp).toLocaleString()}
                              </p>
                            </div>
                            {!notification.read && (
                              <div className="h-2 w-2 bg-blue-500 rounded-full ml-2 mt-1" />
                            )}
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {children}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

