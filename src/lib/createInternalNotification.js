export async function createInternalNotification({
  userEmail = null,
  role = null,
  title,
  message,
  type = null,
  relatedId = null,
  relatedModule = null,
}) {
  try {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_email: userEmail,
        role,
        title,
        message,
        type,
        related_id: relatedId,
        related_module: relatedModule,
      }),
    });
  } catch (error) {
    console.error('[createInternalNotification]', error);
  }
}