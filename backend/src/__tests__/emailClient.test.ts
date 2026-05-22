import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { notifyAdminsViaEmail } from '../services/emailClient.js';

describe('notifyAdminsViaEmail', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should email all admin users regardless of their notificationPreferences', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const mockAdmin = {
      firestore: () => ({
        collection: (colName: string) => {
          expect(colName).toBe('users');
          return {
            where: (field: string, op: string, val: any) => {
              expect(field).toBe('role');
              expect(op).toBe('==');
              expect(val).toBe('admin');
              return {
                get: async () => ({
                  docs: [
                    {
                      data: () => ({
                        email: 'admin1@test.com',
                        role: 'admin',
                        notificationPreferences: {
                          emailRequests: false // Previously blocked, should now be emailed
                        }
                      })
                    },
                    {
                      data: () => ({
                        email: 'admin2@test.com',
                        role: 'admin',
                        notificationPreferences: {
                          emailRequests: true
                        }
                      })
                    },
                    {
                      data: () => ({
                        email: 'admin3@test.com',
                        role: 'admin' // No notification preferences field
                      })
                    }
                  ]
                })
              };
            }
          };
        }
      })
    };

    await notifyAdminsViaEmail(mockAdmin, 'Test Subject', '<p>Test html</p>');

    // Expect console.log to be called 3 times (once for each admin)
    expect(logSpy).toHaveBeenCalledTimes(3);

    const logCalls = logSpy.mock.calls.map(call => call[0]);
    expect(logCalls).toContain('[EMAIL CLIENT] EMAIL_SERVICE_KEY not set. Would send to: admin1@test.com');
    expect(logCalls).toContain('[EMAIL CLIENT] EMAIL_SERVICE_KEY not set. Would send to: admin2@test.com');
    expect(logCalls).toContain('[EMAIL CLIENT] EMAIL_SERVICE_KEY not set. Would send to: admin3@test.com');
  });
});
