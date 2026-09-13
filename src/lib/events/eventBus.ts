import { EventEmitter } from 'events';

export interface AppEvent {
  id: string;
  type: 'workflow_created' | 'workflow_updated' | 'workflow_deleted' | 'run_started' | 'run_completed' | 'step_approved' | 'document_ingested' | 'audit_logged';
  orgId: string;
  userId: string;
  payload: any;
  timestamp: string;
}

class RealtimeEventBus extends EventEmitter {
  private recentEvents: AppEvent[] = [];
  private maxHistory = 100;

  publish(event: Omit<AppEvent, 'id' | 'timestamp'>): AppEvent {
    const fullEvent: AppEvent = {
      ...event,
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };

    this.recentEvents.unshift(fullEvent);
    if (this.recentEvents.length > this.maxHistory) {
      this.recentEvents.pop();
    }

    this.emit('app_event', fullEvent);
    this.emit(`org_${event.orgId}`, fullEvent);
    return fullEvent;
  }

  getEventsForOrg(orgId: string, limit = 20): AppEvent[] {
    return this.recentEvents
      .filter(e => e.orgId === orgId)
      .slice(0, limit);
  }
}

export const eventBus = new RealtimeEventBus();
// Set higher listener limit for SSE client streams
eventBus.setMaxListeners(100);
