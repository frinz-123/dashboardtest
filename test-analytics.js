// Simple test to check if the analytics API is working
fetch('/api/clientes?action=analytics')
  .then(response => response.json())
  .then(data => {
    console.log('Analytics API Response:', data);
    if (data.success) {
      console.log('✅ Analytics data received successfully');
      console.log('Total Sales:', data.data.totalSales);
      console.log('Total Clients:', data.data.totalClients);
      console.log('Top Clients:', data.data.topClients?.length || 0);
      console.log('Top Products:', data.data.topProducts?.length || 0);
    } else {
      console.error('❌ API returned error:', data.error);
    }
  })
  .catch(error => {
    console.error('🚨 Fetch error:', error);
  });
