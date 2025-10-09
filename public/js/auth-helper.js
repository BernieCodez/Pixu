// Auto-login functionality
// This script checks for stored JWT tokens and automatically logs the user in

async function checkAutoLogin() {
  const token = localStorage.getItem('pixalu_auth_token');
  
  if (!token) {
    return null;
  }
  
  try {
    const response = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token })
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.user;
    } else {
      // Token is invalid, clear it
      localStorage.removeItem('pixalu_auth_token');
      localStorage.removeItem('pixalu_session_token');
      return null;
    }
  } catch (error) {
    console.error('Auto-login failed:', error);
    return null;
  }
}

async function logoutUser() {
  const token = localStorage.getItem('pixalu_auth_token');
  
  if (token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token })
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
  
  localStorage.removeItem('pixalu_auth_token');
  localStorage.removeItem('pixalu_session_token');
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { checkAutoLogin, logoutUser };
}
