import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  Snackbar,
  Alert,
  AlertTitle,
  IconButton,
  Box,
  Typography,
  useTheme
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';

// Notification context
const NotificationContext = createContext();

/**
 * Custom hook to use notification system
 */
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

/**
 * Notification types and their configurations
 */
const NOTIFICATION_TYPES = {
  success: {
    icon: SuccessIcon,
    color: 'success',
    defaultDuration: 4000,
  },
  error: {
    icon: ErrorIcon,
    color: 'error',
    defaultDuration: 8000,
  },
  warning: {
    icon: WarningIcon,
    color: 'warning',
    defaultDuration: 6000,
  },
  info: {
    icon: InfoIcon,
    color: 'info',
    defaultDuration: 5000,
  },
};

/**
 * Individual notification component
 */
const NotificationItem = ({ 
  notification, 
  onClose, 
  position = 'bottom-right',
  maxWidth = 400 
}) => {
  const theme = useTheme();
  const config = NOTIFICATION_TYPES[notification.severity] || NOTIFICATION_TYPES.info;
  const IconComponent = config.icon;

  const getPositionStyles = () => {
    const baseStyles = {
      position: 'fixed',
      zIndex: theme.zIndex.snackbar + notification.id,
      maxWidth,
      minWidth: 300,
    };

    switch (position) {
      case 'top-left':
        return { ...baseStyles, top: 16, left: 16 };
      case 'top-right':
        return { ...baseStyles, top: 16, right: 16 };
      case 'top-center':
        return { ...baseStyles, top: 16, left: '50%', transform: 'translateX(-50%)' };
      case 'bottom-left':
        return { ...baseStyles, bottom: 16, left: 16 };
      case 'bottom-center':
        return { ...baseStyles, bottom: 16, left: '50%', transform: 'translateX(-50%)' };
      case 'bottom-right':
      default:
        return { ...baseStyles, bottom: 16, right: 16 };
    }
  };

  return (
    <Snackbar
      open={true}
      autoHideDuration={notification.duration}
      onClose={() => onClose(notification.id)}
      sx={getPositionStyles()}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Alert
        severity={notification.severity}
        variant="filled"
        onClose={() => onClose(notification.id)}
        icon={<IconComponent />}
        sx={{
          width: '100%',
          '& .MuiAlert-message': {
            width: '100%',
          },
        }}
      >
        {notification.title && (
          <AlertTitle sx={{ mb: notification.message ? 1 : 0 }}>
            {notification.title}
          </AlertTitle>
        )}
        
        {notification.message && (
          <Typography variant="body2" component="div">
            {notification.message}
          </Typography>
        )}
        
        {notification.details && (
          <Typography 
            variant="caption" 
            component="div" 
            sx={{ 
              mt: 1, 
              opacity: 0.8,
              fontSize: '0.75rem'
            }}
          >
            {notification.details}
          </Typography>
        )}
        
        {notification.actions && (
          <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
            {notification.actions.map((action, index) => (
              <IconButton
                key={index}
                size="small"
                onClick={() => {
                  action.onClick();
                  if (action.closeOnClick !== false) {
                    onClose(notification.id);
                  }
                }}
                sx={{ color: 'inherit' }}
              >
                {action.icon}
              </IconButton>
            ))}
          </Box>
        )}
      </Alert>
    </Snackbar>
  );
};

/**
 * Notification Provider Component
 * Manages notification state and provides notification methods
 */
const NotificationProvider = ({ 
  children, 
  maxNotifications = 5,
  position = 'bottom-right',
  stackSpacing = 70 
}) => {
  const [notifications, setNotifications] = useState([]);
  const notificationIdRef = useRef(0);

  /**
   * Add a new notification
   */
  const addNotification = useCallback((options) => {
    const {
      message,
      title,
      details,
      severity = 'info',
      duration,
      persistent = false,
      actions = [],
      id: customId
    } = options;

    const id = customId || ++notificationIdRef.current;
    const config = NOTIFICATION_TYPES[severity] || NOTIFICATION_TYPES.info;
    const finalDuration = persistent ? null : (duration || config.defaultDuration);

    const notification = {
      id,
      message,
      title,
      details,
      severity,
      duration: finalDuration,
      persistent,
      actions,
      timestamp: Date.now(),
    };

    setNotifications(prev => {
      const updated = [...prev, notification];
      
      // Limit number of notifications
      if (updated.length > maxNotifications) {
        return updated.slice(-maxNotifications);
      }
      
      return updated;
    });

    // Auto-remove notification after duration (if not persistent)
    if (!persistent && finalDuration) {
      setTimeout(() => {
        removeNotification(id);
      }, finalDuration);
    }

    return id;
  }, [maxNotifications]);

  /**
   * Remove notification by ID
   */
  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  /**
   * Remove all notifications
   */
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  /**
   * Update existing notification
   */
  const updateNotification = useCallback((id, updates) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, ...updates, timestamp: Date.now() }
          : notification
      )
    );
  }, []);

  /**
   * Convenience methods for different notification types
   */
  const success = useCallback((message, options = {}) => {
    return addNotification({ ...options, message, severity: 'success' });
  }, [addNotification]);

  const error = useCallback((message, options = {}) => {
    return addNotification({ ...options, message, severity: 'error' });
  }, [addNotification]);

  const warning = useCallback((message, options = {}) => {
    return addNotification({ ...options, message, severity: 'warning' });
  }, [addNotification]);

  const info = useCallback((message, options = {}) => {
    return addNotification({ ...options, message, severity: 'info' });
  }, [addNotification]);

  /**
   * Get notification statistics
   */
  const getStats = useCallback(() => {
    return {
      total: notifications.length,
      byType: notifications.reduce((acc, notification) => {
        acc[notification.severity] = (acc[notification.severity] || 0) + 1;
        return acc;
      }, {}),
      persistent: notifications.filter(n => n.persistent).length,
    };
  }, [notifications]);

  const contextValue = {
    notifications,
    addNotification,
    removeNotification,
    clearNotifications,
    updateNotification,
    success,
    error,
    warning,
    info,
    getStats,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      
      {/* Render notifications */}
      {notifications.map((notification, index) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClose={removeNotification}
          position={position}
          style={{
            [position.includes('bottom') ? 'bottom' : 'top']: 
              16 + (index * stackSpacing),
          }}
        />
      ))}
    </NotificationContext.Provider>
  );
};

export default NotificationProvider;