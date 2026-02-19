# Meta API Implementation Patterns

Practical code patterns for implementing the Meta API Expert recommendations.

## Dynamic Field Validation (TypeScript)

This pattern handles the "Auto-Depuration" of fields when Meta returns a #100 error.

```typescript
async function fetchInsightsWithRetry(objectId: string, fields: string[], accessToken: string) {
  let currentFields = [...fields];
  
  while (currentFields.length > 0) {
    try {
      const url = `https://graph.facebook.com/v18.0/${objectId}/insights?fields=${currentFields.join(',')}&access_token=${accessToken}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.error && data.error.code === 100) {
        // Parse the error message to find which field is invalid
        const match = data.error.message.match(/([^ ]+) is not valid for fields param/);
        if (match) {
          const invalidField = match[1];
          console.warn(`Removing invalid field: ${invalidField}`);
          currentFields = currentFields.filter(f => f !== invalidField);
          continue; // Retry with remaining fields
        }
      }
      
      return data;
    } catch (error) {
      console.error("Meta API Request Failed", error);
      throw error;
    }
  }
}
```

## Discovery via Metadata

Use this once per major version update or when a new account is linked.

```typescript
async function discoverAvailableFields(adAccountId: string, accessToken: string) {
  const url = `https://graph.facebook.com/v18.0/act_${adAccountId}/insights?metadata=1&access_token=${accessToken}`;
  const response = await fetch(url);
  const json = await response.json();
  
  return json.metadata?.fields?.map((f: any) => f.name) || [];
}
```

## Handling Action Arrays

Filter and sum actions to derive business KPIs.

```typescript
function getMetricFromActions(actions: any[], type: string): number {
  return actions
    .filter(a => a.action_type === type)
    .reduce((sum, a) => sum + parseInt(a.value || "0"), 0);
}

// Example usage:
const purchases = getMetricFromActions(data.actions, 'purchase');
const leads = getMetricFromActions(data.actions, 'lead');
```
