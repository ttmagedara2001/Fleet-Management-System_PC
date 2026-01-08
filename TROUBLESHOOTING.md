# 🔧 Fabrix - Troubleshooting Guide

<div align="center">

**Solutions to Common Issues and Problems**

</div>

---

## 📋 Table of Contents

1. [Connection Issues](#1-connection-issues)
2. [Authentication Problems](#2-authentication-problems)
3. [Dashboard Issues](#3-dashboard-issues)
4. [Robot Monitoring Issues](#4-robot-monitoring-issues)
5. [Environmental Data Issues](#5-environmental-data-issues)
6. [Analysis Page Issues](#6-analysis-page-issues)
7. [Settings Issues](#7-settings-issues)
8. [Performance Issues](#8-performance-issues)
9. [Error Messages](#9-error-messages)
10. [Getting Help](#10-getting-help)

---

## 1. Connection Issues

### 1.1 "OFFLINE" Status in Header

**Symptoms:**

- Header shows 🔴 OFFLINE
- No real-time data updates
- Robot positions not updating

**Causes & Solutions:**

| Cause                       | Solution                          |
| --------------------------- | --------------------------------- |
| Network disconnection       | Check your internet connection    |
| WebSocket server down       | Contact system administrator      |
| Firewall blocking WebSocket | Allow WSS connections on port 443 |
| Browser blocking connection | Try a different browser           |

**Steps to resolve:**

1. Check your internet connection
2. Refresh the page (F5 or Ctrl+R)
3. Clear browser cache and cookies
4. Check browser console for errors (F12 → Console)
5. Verify the WebSocket URL in your `.env` file

### 1.2 Constant Reconnecting

**Symptoms:**

- Status flickers between ONLINE and OFFLINE
- Data appears and disappears

**Solutions:**

1. Check for unstable network connection
2. Reduce the number of open browser tabs
3. Disable browser extensions that may interfere
4. Check if VPN is causing connection issues

### 1.3 WebSocket Connection Failed

**Error:** `WebSocket connection to 'wss://...' failed`

**Solutions:**

1. Verify `VITE_WS_URL` in `.env` is correct
2. Ensure the WebSocket server is running
3. Check for CORS issues
4. Verify SSL certificate is valid

---

## 2. Authentication Problems

### 2.1 "Invalid Credentials" Error

**Symptoms:**

- Login fails with "Invalid credentials"
- Application stuck on loading screen

**Causes & Solutions:**

| Cause                                      | Solution                                  |
| ------------------------------------------ | ----------------------------------------- |
| Wrong email                                | Verify `VITE_USER_EMAIL` in `.env`        |
| Wrong secret key                           | Get correct key from ProtoNest dashboard  |
| Using login password instead of secret key | Use the **Secret Key**, not your password |
| Expired credentials                        | Generate new secret key                   |

### 2.2 "Email Not Verified" Error

**Solution:**

1. Log into ProtoNest dashboard
2. Check for verification email
3. Complete email verification process
4. Restart the application

### 2.3 Token Expired

**Symptoms:**

- Application worked before but now fails
- API calls return 401 errors

**Solution:**

1. Clear localStorage: Open DevTools (F12) → Application → Local Storage → Clear All
2. Refresh the page
3. System will automatically re-authenticate

### 2.4 "User Not Found" Error

**Solutions:**

1. Verify the email address is registered
2. Check for typos in `VITE_USER_EMAIL`
3. Register a new account if needed

---

## 3. Dashboard Issues

### 3.1 Dashboard Shows No Data

**Symptoms:**

- All panels show empty or default values
- "--" displayed instead of numbers

**Solutions:**

1. **Check device selection**

   - Ensure a device is selected in the dropdown
   - Try selecting a different device

2. **Verify WebSocket connection**

   - Check header for ONLINE status
   - Look for "STOMP connected" in browser console

3. **Check for data availability**
   - New devices may not have historical data
   - Wait for IoT device to send data

### 3.2 Dashboard Panels Not Loading

**Solutions:**

1. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. Clear browser cache
3. Check browser console for JavaScript errors
4. Disable ad blockers temporarily

### 3.3 Layout Looks Broken

**Symptoms:**

- Panels overlapping
- Missing styles
- Incorrect spacing

**Solutions:**

1. Zoom reset: Ctrl+0 (Windows) or Cmd+0 (Mac)
2. Try a different browser
3. Clear browser cache
4. Check if TailwindCSS is loading correctly

---

## 4. Robot Monitoring Issues

### 4.1 Robots Not Appearing

**Symptoms:**

- Robot Fleet Panel is empty
- Facility Map shows no robot markers

**Causes & Solutions:**

| Cause                           | Solution                              |
| ------------------------------- | ------------------------------------- |
| No robots configured            | Check device has robots assigned      |
| WebSocket not connected         | Verify ONLINE status                  |
| Wrong device selected           | Select correct device from dropdown   |
| Robot topic subscription failed | Check console for subscription errors |

### 4.2 Robot Data Not Updating

**Symptoms:**

- Robot position stays the same
- Battery level doesn't change
- Status stuck on one value

**Solutions:**

1. Check WebSocket connection status
2. Verify robot is actually sending data
3. Refresh the page
4. Check browser console for topic subscription messages

### 4.3 Robot Shows "Unknown" Status

**Solutions:**

1. Wait for next status update (usually within 5 seconds)
2. Check if robot is powered on
3. Verify robot is connected to network
4. Check IoT gateway connectivity

### 4.4 Battery Shows "--"

**Causes:**

- Robot hasn't reported battery level yet
- Battery sensor malfunction
- Data format incompatible

**Solution:** Wait for robot to send battery update, or check robot hardware.

---

## 5. Environmental Data Issues

### 5.1 Sensors Showing "--"

**Symptoms:**

- Temperature, humidity, or pressure shows "--"

**Causes & Solutions:**

| Cause                    | Solution                         |
| ------------------------ | -------------------------------- |
| Sensor not connected     | Check physical sensor            |
| Device offline           | Verify IoT gateway               |
| Data subscription failed | Check console for errors         |
| New device setup         | Wait for first data transmission |

### 5.2 Sensor Values Seem Wrong

**Symptoms:**

- Temperature shows impossible values (e.g., -999°C)
- Humidity over 100%
- Sudden spikes in readings

**Solutions:**

1. Check physical sensors for damage
2. Verify sensor calibration
3. Check for data transmission errors
4. Contact hardware maintenance

### 5.3 AC/Air Purifier Controls Not Working

**Symptoms:**

- Toggle doesn't change
- No response when clicking controls

**Causes & Solutions:**

| Cause             | Solution                               |
| ----------------- | -------------------------------------- |
| No token          | Re-authenticate (refresh page)         |
| API error         | Check console for error messages       |
| Device offline    | Verify IoT gateway connection          |
| Permission denied | Verify account has control permissions |

**Troubleshooting steps:**

1. Click the control
2. Wait 3-5 seconds
3. If no change, check browser console (F12)
4. Look for API response errors
5. Verify device is responding

---

## 6. Analysis Page Issues

### 6.1 Chart Shows No Data

**Symptoms:**

- Empty chart area
- "No data available" message

**Solutions:**

1. **Check time range**

   - Try a longer time range (7d or 30d)
   - Ensure data exists for selected period

2. **Verify device selection**

   - Check correct device is selected
   - Try a different device

3. **Check metric filters**

   - Ensure at least one metric is enabled
   - Toggle metrics on if all are off

4. **Refresh data**
   - Click the Refresh button
   - Check console for API errors

### 6.2 Chart Data Appears Stale

**Solutions:**

1. Click Refresh button to fetch latest data
2. Check time range is set correctly
3. Verify API endpoint is responding

### 6.3 CSV Export Not Working

**Symptoms:**

- Nothing happens when clicking Export
- File doesn't download

**Solutions:**

1. Check browser allows downloads
2. Disable popup blockers
3. Try a different browser
4. Ensure there is data to export

### 6.4 "Failed to Fetch Data" Error

**Causes & Solutions:**

| Cause         | Solution                        |
| ------------- | ------------------------------- |
| Network error | Check internet connection       |
| API timeout   | Try smaller time range          |
| Invalid token | Refresh page to re-authenticate |
| Server error  | Wait and retry, contact admin   |

---

## 7. Settings Issues

### 7.1 Settings Not Saving

**Symptoms:**

- Changes revert after leaving page
- "Save" doesn't show confirmation

**Solutions:**

1. Click the Save button (don't just change values)
2. Check browser allows localStorage
3. Check browser is not in private/incognito mode
4. Clear localStorage and try again

### 7.2 Thresholds Not Triggering Alerts

**Solutions:**

1. Verify settings were saved (check for confirmation message)
2. Ensure current values actually exceed thresholds
3. Check that System Mode is set appropriately
4. Refresh the page to apply new settings

### 7.3 Robot Settings Not Applying

**Symptoms:**

- Task assignment doesn't work
- Robot doesn't move to assigned location

**Solutions:**

1. Verify robot is ONLINE and IDLE
2. Check robot has sufficient battery
3. Ensure task type is compatible with robot
4. Verify source and destination are selected

---

## 8. Performance Issues

### 8.1 Application Running Slowly

**Symptoms:**

- Laggy interface
- Delayed updates
- High CPU usage

**Solutions:**

1. **Reduce browser load**

   - Close unnecessary tabs
   - Disable heavy extensions
   - Clear browser cache

2. **Optimize data loading**

   - Use shorter time ranges in Analysis
   - Reduce number of active subscriptions

3. **Check system resources**
   - Close other heavy applications
   - Check available RAM
   - Restart browser

### 8.2 Memory Leaks

**Symptoms:**

- Application gets slower over time
- Browser tab uses excessive memory

**Solutions:**

1. Refresh the page periodically
2. Report issue to developers with steps to reproduce
3. Check for browser updates

### 8.3 High Network Usage

**Solutions:**

1. This is normal for real-time applications
2. Reduce active devices if not needed
3. Consider using metered connection mode

---

## 9. Error Messages

### Common Error Messages and Solutions

| Error                       | Meaning                   | Solution                           |
| --------------------------- | ------------------------- | ---------------------------------- |
| `Network Error`             | Cannot reach API server   | Check internet, verify API URL     |
| `401 Unauthorized`          | Token expired or invalid  | Refresh page to re-authenticate    |
| `403 Forbidden`             | No permission             | Check account permissions          |
| `404 Not Found`             | Endpoint doesn't exist    | Verify API configuration           |
| `500 Internal Server Error` | Server-side issue         | Wait and retry, contact admin      |
| `STOMP connection failed`   | WebSocket issue           | Check WebSocket URL and network    |
| `Invalid token`             | Auth token corrupt        | Clear localStorage, refresh        |
| `Subscription failed`       | Cannot subscribe to topic | Check topic format and permissions |

### Reading Browser Console Errors

1. Open DevTools: Press F12 or right-click → Inspect
2. Go to Console tab
3. Look for red error messages
4. Common prefixes:
   - `❌ API Error:` - REST API issues
   - `❌ WEBSOCKET:` - WebSocket issues
   - `❌ AUTH:` - Authentication issues

---

## 10. Getting Help

### 10.1 Before Contacting Support

Gather the following information:

1. Screenshot of the issue
2. Browser console errors (F12 → Console)
3. Browser type and version
4. Steps to reproduce the issue
5. Time when issue occurred

### 10.2 Self-Help Resources

| Resource                             | Purpose                 |
| ------------------------------------ | ----------------------- |
| [README.md](README.md)               | Setup and configuration |
| [USER_MANUAL.md](USER_MANUAL.md)     | How to use features     |
| [API_REFERENCE.md](API_REFERENCE.md) | API documentation       |
| Browser Console                      | Real-time error logs    |

### 10.3 Useful Browser Commands

| Command           | Action                     |
| ----------------- | -------------------------- |
| F5                | Refresh page               |
| Ctrl+Shift+R      | Hard refresh (clear cache) |
| F12               | Open Developer Tools       |
| Ctrl+Shift+Delete | Clear browsing data        |

### 10.4 Quick Fixes Checklist

When something isn't working, try these in order:

- [ ] Refresh the page (F5)
- [ ] Hard refresh (Ctrl+Shift+R)
- [ ] Check internet connection
- [ ] Check header connection status
- [ ] Open console (F12) and check for errors
- [ ] Clear browser cache and cookies
- [ ] Try a different browser
- [ ] Clear localStorage and re-authenticate
- [ ] Restart the development server
- [ ] Contact system administrator

---

<div align="center">

**Still having issues? Contact your system administrator.**

</div>
