import { BackHandler, Platform } from 'react-native';

export type BackHandlerFn = () => boolean;

interface RegisteredHandler {
  id: string;
  fn: BackHandlerFn;
  priority: number;
}

class NavigationService {
  private handlers: RegisteredHandler[] = [];
  private isListening = false;
  private rootBackHandler: (() => boolean) | null = null;

  init() {
    if (this.isListening) return;
    if (Platform.OS === 'android') {
      BackHandler.addEventListener('hardwareBackPress', this.handleHardwareBack);
    }
    this.isListening = true;
  }

  private handleHardwareBack = (): boolean => {
    return this.executeBack();
  };

  /**
   * Register a back press handler.
   * Priority Guide:
   * - 100+ : Top-level modals, popups, full-screen dialogs
   * - 70-90: Sub-views (e.g., Settings sub-screens)
   * - 40-60: In-screen state (e.g., selected member profile, expanded bottom sheet)
   * - 10-30: Tab history navigation
   * - 0    : Root screen fallback
   *
   * Return `true` if your handler consumed the back event.
   * Return `false` to let lower-priority handlers execute.
   */
  registerBackHandler(id: string, fn: BackHandlerFn, priority: number = 0): () => void {
    this.init();
    // Remove existing with same id if any
    this.handlers = this.handlers.filter((h) => h.id !== id);
    this.handlers.push({ id, fn, priority });
    // Sort descending: highest priority first
    this.handlers.sort((a, b) => b.priority - a.priority);

    return () => {
      this.handlers = this.handlers.filter((h) => h.id !== id);
    };
  }

  setRootBackHandler(fn: (() => boolean) | null) {
    this.rootBackHandler = fn;
  }

  /**
   * Trigger the highest priority back action.
   * Returns true if handled, false if unhandled.
   * Universal: called by Android hardware back, iOS swipe gestures, and UI back buttons.
   */
  executeBack(): boolean {
    for (const handler of this.handlers) {
      try {
        const handled = handler.fn();
        if (handled) {
          return true;
        }
      } catch (err) {
        console.warn(`[NavigationService] Handler "${handler.id}" error:`, err);
      }
    }

    if (this.rootBackHandler) {
      try {
        return this.rootBackHandler();
      } catch (err) {
        console.warn('[NavigationService] Root back handler error:', err);
      }
    }

    return false;
  }
}

export const navigationService = new NavigationService();
