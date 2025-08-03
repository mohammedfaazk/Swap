"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, Info, X, ExternalLink } from 'lucide-react';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  txHash?: string;
  explorerUrl?: string;
  duration?: number;
  persistent?: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification = { ...notification, id };
    
    setNotifications(prev => [...prev, newNotification]);

    // Auto-remove after duration (default 5 seconds)
    if (!notification.persistent) {
      setTimeout(() => {
        removeNotification(id);
      }, notification.duration || 5000);
    }
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider value={{
      notifications,
      addNotification,
      removeNotification,
      clearAll
    }}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
}

function NotificationContainer() {
  const { notifications, removeNotification } = useNotifications();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => (
        <NotificationCard
          key={notification.id}
          notification={notification}
          onRemove={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
}

function NotificationCard({ 
  notification, 
  onRemove 
}: { 
  notification: Notification; 
  onRemove: () => void;
}) {
  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-400" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  const getBorderColor = () => {
    switch (notification.type) {
      case 'success':
        return 'border-green-500/50';
      case 'error':
        return 'border-red-500/50';
      case 'warning':
        return 'border-yellow-500/50';
      case 'info':
      default:
        return 'border-blue-500/50';
    }
  };

  const getBackgroundColor = () => {
    switch (notification.type) {
      case 'success':
        return 'bg-green-900/30';
      case 'error':
        return 'bg-red-900/30';
      case 'warning':
        return 'bg-yellow-900/30';
      case 'info':
      default:
        return 'bg-blue-900/30';
    }
  };

  return (
    <div className={`${getBackgroundColor()} ${getBorderColor()} border backdrop-blur-sm rounded-lg p-4 shadow-lg animate-in slide-in-from-right duration-300`}>
      <div className="flex items-start space-x-3">
        {getIcon()}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-white">{notification.title}</h4>
          <p className="text-sm text-slate-300 mt-1">{notification.message}</p>
          
          {notification.txHash && (
            <div className="mt-2">
              <button
                onClick={() => window.open(notification.explorerUrl || `https://sepolia.etherscan.io/tx/${notification.txHash}`, '_blank')}
                className="inline-flex items-center text-xs text-blue-300 hover:text-blue-200 transition-colors"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                View Transaction
              </button>
            </div>
          )}
        </div>
        <button
          onClick={onRemove}
          className="text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}