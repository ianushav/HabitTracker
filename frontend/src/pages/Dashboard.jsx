import React, { useEffect, useState, useRef } from "react";
import "../styles/dashboard.css";
import {
  FiPlus, FiCheck, FiTrendingUp, FiCalendar, FiActivity,
  FiBarChart2, FiLogOut, FiUser, FiSettings,
  FiChevronLeft, FiChevronRight, FiEdit, FiTrash2, FiX, FiSave
} from "react-icons/fi";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isToday } from "date-fns";

const API_URL = "https://habittracker-133y.onrender.com/api";

// Predefined colors for habits
const HABIT_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", 
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1"
];

export default function Dashboard() {
  const [habits, setHabits] = useState([]);
  const [stats, setStats] = useState({
    total_habits: 0,
    completed_today: 0,
    total_streak: 0,
    longest_streak: 0,
    success_rate: 0,
  });
  const [user, setUser] = useState(null);
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [newHabit, setNewHabit] = useState({
    title: "",
    description: "",
    frequency: "daily",
    color: HABIT_COLORS[Math.floor(Math.random() * HABIT_COLORS.length)]
  });
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const tableRef = useRef(null);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        fetchUserData(parsedUser.id);
      } catch (error) {
        console.error("Error parsing user data:", error);
        window.location.href = "/";
      }
    } else {
      window.location.href = "/";
    }
  }, []);

  const fetchUserData = async (userId) => {
    try {
      console.log("Fetching data for user:", userId);
      
      const [habitsRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/users/${userId}/habits`),
        fetch(`${API_URL}/users/${userId}/stats`)
      ]);
      
      console.log("Habits response:", habitsRes.status);
      console.log("Stats response:", statsRes.status);
      
      if (habitsRes.ok && statsRes.ok) {
        const habitsData = await habitsRes.json();
        const statsData = await statsRes.json();
        
        console.log("Habits data:", habitsData);
        console.log("Stats data:", statsData);
        
        setHabits(habitsData);
        setStats(statsData);
      } else {
        console.error("Failed to fetch data");
        if (habitsRes.status === 404) {
          console.error("User not found or no habits");
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddHabit = async (e) => {
    e.preventDefault();
    try {
      console.log("Adding habit with data:", {
        ...newHabit,
        user_id: user.id,
        target_days: 1
      });
      
      const response = await fetch(`${API_URL}/habits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newHabit.title,
          description: newHabit.description,
          frequency: newHabit.frequency,
          color: newHabit.color,
          user_id: user.id,
          target_days: 1
        })
      });

      console.log("Add habit response status:", response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log("Habit created successfully:", data);
        
        setShowAddHabit(false);
        setNewHabit({
          title: "",
          description: "",
          frequency: "daily",
          color: HABIT_COLORS[Math.floor(Math.random() * HABIT_COLORS.length)]
        });
        fetchUserData(user.id);
      } else {
        const errorData = await response.json();
        console.error("Server error:", errorData);
        alert(`Error adding habit: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Error adding habit:", error);
      alert("Error adding habit. Please try again.");
    }
  };

  const handleUpdateHabit = async (e) => {
    e.preventDefault();
    try {
      console.log("Updating habit with data:", editingHabit);
      
      const response = await fetch(`${API_URL}/habits/${editingHabit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editingHabit.title,
          description: editingHabit.description,
          frequency: editingHabit.frequency,
          color: editingHabit.color
        })
      });

      console.log("Update habit response status:", response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log("Habit updated successfully:", data);
        
        setEditingHabit(null);
        fetchUserData(user.id);
      } else {
        const errorData = await response.json();
        console.error("Server error:", errorData);
        alert(`Error updating habit: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Error updating habit:", error);
      alert("Error updating habit. Please try again.");
    }
  };

  const handleDeleteHabit = async (habitId) => {
    if (!window.confirm("Are you sure you want to delete this habit? This will delete all completion history too.")) {
      return;
    }

    try {
      console.log("Deleting habit:", habitId);
      
      const response = await fetch(`${API_URL}/habits/${habitId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
      });

      console.log("Delete habit response status:", response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log("Habit deleted successfully:", data);
        
        fetchUserData(user.id);
      } else {
        const errorData = await response.json();
        console.error("Server error:", errorData);
        alert(`Error deleting habit: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Error deleting habit:", error);
      alert("Error deleting habit. Please try again.");
    }
  };

  const handleToggleHabit = async (habitId, date, isFuture) => {
    if (isFuture) {
      alert("Cannot mark habits for future dates!");
      return;
    }
    
    try {
      const habit = habits.find(h => h.id === habitId);
      const isCompleted = habit?.completions?.includes(date);
      
      console.log("Toggling habit:", { habitId, date, isCompleted, isFuture });
      
      const endpoint = isCompleted ? 'uncomplete' : 'complete';
      const response = await fetch(`${API_URL}/habits/${habitId}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date })
      });
      
      console.log("Toggle response status:", response.status);
      
      if (response.ok) {
        console.log(`${isCompleted ? 'Uncompleted' : 'Completed'} habit for:`, date);
        fetchUserData(user.id);
      } else {
        const errorData = await response.json();
        console.error("Server error:", errorData);
        alert(`Error: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Error toggling habit:", error);
      alert("Error updating habit. Please try again.");
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  // Generate days for current month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Navigate months
  const prevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  // Calculate month stats
  const calculateMonthStats = () => {
    const totalPossible = habits.length * monthDays.length;
    let totalCompleted = 0;
    
    habits.forEach(habit => {
      monthDays.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        if (habit.completions?.includes(dateStr)) {
          totalCompleted++;
        }
      });
    });
    
    const monthlyProgress = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;
    const daysPassed = monthDays.filter(day => day <= new Date()).length;
    const normalizedProgress = daysPassed > 0 ? Math.round((totalCompleted / (habits.length * daysPassed)) * 100) : 0;
    
    return {
      monthlyProgress,
      normalizedProgress,
      totalCompleted,
      totalPossible
    };
  };

  const monthStats = calculateMonthStats();

  // Calculate today's completion percentage
  const calculateTodayCompletion = () => {
    if (habits.length === 0) return 0;
    const today = format(new Date(), 'yyyy-MM-dd');
    const completedToday = habits.filter(habit => 
      habit.completions?.includes(today)
    ).length;
    return Math.round((completedToday / habits.length) * 100);
  };

  const todayCompletion = calculateTodayCompletion();

  const handleEditClick = (habit) => {
    setEditingHabit({
      id: habit.id,
      title: habit.title,
      description: habit.description || '',
      frequency: habit.frequency,
      color: habit.color || HABIT_COLORS[0]
    });
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <FiActivity className="sidebar-logo" />
          <h2>Habit Tracker</h2>
        </div>
        
        <div className="user-info">
          <div className="user-avatar">
            <FiUser />
          </div>
          <div className="user-details">
            <h3>{user?.username}</h3>
            <p>{user?.email}</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <a href="#dashboard" className="nav-item active">
            <FiCalendar />
            <span>Calendar View</span>
          </a>
          <a href="#settings" className="nav-item">
            <FiSettings />
            <span>Settings</span>
          </a>
        </nav>

        <div className="today-completion">
          <div className="completion-circle">
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle
                cx="40"
                cy="40"
                r="36"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="8"
              />
              <circle
                cx="40"
                cy="40"
                r="36"
                fill="none"
                stroke="#10B981"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${todayCompletion * 2.26} 226`}
                strokeDashoffset="0"
                transform="rotate(-90 40 40)"
              />
            </svg>
            <div className="completion-percent">{todayCompletion}%</div>
          </div>
          <p>Today's Completion</p>
        </div>

        <button className="logout-btn" onClick={handleLogout}>
          <FiLogOut />
          <span>Logout</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="main-header">
          <div className="header-left">
            <h1>Habit Tracker Dashboard</h1>
            <p>{format(currentMonth, 'MMMM yyyy')} • {habits.length} habits</p>
          </div>
          <div className="header-right">
            <button 
              className="add-habit-btn"
              onClick={() => setShowAddHabit(true)}
            >
              <FiPlus />
              <span>Add Habit</span>
            </button>
          </div>
        </header>

        {/* Month Navigation */}
        <div className="month-navigation">
          <button onClick={prevMonth} className="nav-button">
            <FiChevronLeft />
            Previous Month
          </button>
          
          <div className="month-display">
            <h2>{format(currentMonth, 'MMMM yyyy')}</h2>
            <button onClick={goToToday} className="today-button">
              Go to Today
            </button>
          </div>
          
          <button onClick={nextMonth} className="nav-button">
            Next Month
            <FiChevronRight />
          </button>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: '#3B82F620' }}>
              <FiActivity style={{ color: '#3B82F6' }} />
            </div>
            <div className="stat-content">
              <h3>{stats.total_habits}</h3>
              <p>Total Habits</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: '#10B98120' }}>
              <FiCheck style={{ color: '#10B981' }} />
            </div>
            <div className="stat-content">
              <h3>{stats.completed_today}</h3>
              <p>Completed Today</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: '#F59E0B20' }}>
              <FiTrendingUp style={{ color: '#F59E0B' }} />
            </div>
            <div className="stat-content">
              <h3>{stats.total_streak}</h3>
              <p>Current Streak</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: '#8B5CF620' }}>
              <FiBarChart2 style={{ color: '#8B5CF6' }} />
            </div>
            <div className="stat-content">
              <h3>{stats.success_rate}%</h3>
              <p>Success Rate</p>
            </div>
          </div>
        </div>

        {/* Habits Table - Calendar View */}
        <div className="calendar-section">
          <div className="section-header">
            <h2>Monthly Habit Tracker</h2>
            <span className="badge">{format(currentMonth, 'MMMM yyyy')}</span>
          </div>
          
          <div className="calendar-container" ref={tableRef}>
            <table className="habit-calendar">
              <thead>
                <tr>
                  <th className="habit-header">Habit</th>
                  <th className="goal-header">Frequency</th>
                  {monthDays.map(day => {
                    const isTodayDate = isToday(day);
                    return (
                      <th 
                        key={day.toISOString()} 
                        className={`day-header ${isTodayDate ? 'today-header' : ''}`}
                      >
                        <div className={`day-number ${isTodayDate ? 'today-number' : ''}`}>
                          {format(day, 'd')}
                        </div>
                        <div className="day-name">{format(day, 'EEE')}</div>
                      </th>
                    );
                  })}
                  <th className="progress-header">Progress</th>
                  <th className="actions-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {habits.length === 0 ? (
                  <tr>
                    <td colSpan={monthDays.length + 4} className="empty-table-cell">
                      <div className="empty-state">
                        <FiActivity className="empty-icon" />
                        <h3>No habits yet</h3>
                        <p>Start by adding your first habit!</p>
                        <button 
                          className="primary-btn"
                          onClick={() => setShowAddHabit(true)}
                        >
                          <FiPlus />
                          Add First Habit
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  habits.map(habit => {
                    const habitCompletions = monthDays.filter(day => 
                      habit.completions?.includes(format(day, 'yyyy-MM-dd'))
                    ).length;
                    const progress = monthDays.length > 0 
                      ? Math.round((habitCompletions / monthDays.length) * 100) 
                      : 0;
                    
                    return (
                      <tr key={habit.id} className="habit-row">
                        <td className="habit-cell">
                          <div className="habit-info-cell">
                            <div 
                              className="habit-color-dot"
                              style={{ backgroundColor: habit.color }}
                            />
                            <div>
                              <div className="habit-title">{habit.title}</div>
                              {habit.description && (
                                <div className="habit-description">{habit.description}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="goal-cell">
                          <span className="frequency-badge">
                            {habit.frequency}
                          </span>
                        </td>
                        {monthDays.map(day => {
                          const dateStr = format(day, 'yyyy-MM-dd');
                          const isCompleted = habit.completions?.includes(dateStr);
                          const isFuture = day > new Date();
                          const isTodayDate = isToday(day);
                          
                          return (
                            <td 
                              key={day.toISOString()} 
                              className={`day-cell ${isTodayDate ? 'today-cell' : ''} ${isFuture ? 'future-cell' : ''}`}
                            >
                              <button
                                className={`day-checkbox ${isCompleted ? 'completed' : ''} ${isFuture ? 'future' : ''}`}
                                onClick={() => handleToggleHabit(habit.id, dateStr, isFuture)}
                                disabled={isFuture}
                                style={{
                                  backgroundColor: isCompleted ? habit.color : 'transparent',
                                  borderColor: habit.color,
                                  cursor: isFuture ? 'not-allowed' : 'pointer',
                                  opacity: isFuture ? 0.3 : 1
                                }}
                                title={isFuture ? "Future date - Cannot mark" : `${format(day, 'MMMM d, yyyy')}\nClick to ${isCompleted ? 'unmark' : 'mark'}`}
                              >
                                {isCompleted && (
                                  <FiCheck style={{ 
                                    fontSize: '14px',
                                    color: 'white',
                                    fontWeight: 'bold'
                                  }} />
                                )}
                              </button>
                            </td>
                          );
                        })}
                        <td className="progress-cell">
                          <div className="habit-progress">
                            <div className="progress-text">{progress}%</div>
                            <div className="progress-bar">
                              <div 
                                className="progress-fill"
                                style={{ 
                                  width: `${progress}%`,
                                  backgroundColor: habit.color
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="actions-cell">
                          <div className="habit-actions">
                            <button 
                              className="edit-btn"
                              onClick={() => handleEditClick(habit)}
                              title="Edit Habit"
                            >
                              <FiEdit />
                            </button>
                            <button 
                              className="delete-btn"
                              onClick={() => handleDeleteHabit(habit.id)}
                              title="Delete Habit"
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Monthly Summary */}
        <div className="section">
          <h2>Monthly Summary</h2>
          <div className="summary-stats">
            <div className="summary-card">
              <div className="summary-number">{monthStats.monthlyProgress}%</div>
              <div className="summary-label">Monthly Progress</div>
            </div>
            <div className="summary-card">
              <div className="summary-number">{monthStats.normalizedProgress}%</div>
              <div className="summary-label">Normalized Progress</div>
            </div>
            <div className="summary-card">
              <div className="summary-number">{stats.total_streak} days</div>
              <div className="summary-label">Current Streak</div>
            </div>
            <div className="summary-card">
              <div className="summary-number">{stats.longest_streak} days</div>
              <div className="summary-label">Longest Streak</div>
            </div>
          </div>
        </div>
      </main>

      {/* Add Habit Modal */}
      {showAddHabit && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Add New Habit</h3>
              <button className="close-btn" onClick={() => setShowAddHabit(false)}>
                <FiX />
              </button>
            </div>
            
            <form onSubmit={handleAddHabit}>
              <div className="form-group">
                <label>Habit Name *</label>
                <input
                  type="text"
                  value={newHabit.title}
                  onChange={(e) => setNewHabit({...newHabit, title: e.target.value})}
                  placeholder="e.g., Morning Exercise"
                  required
                  autoFocus
                />
              </div>
              
              <div className="form-group">
                <label>Description (Optional)</label>
                <textarea
                  value={newHabit.description}
                  onChange={(e) => setNewHabit({...newHabit, description: e.target.value})}
                  placeholder="Describe your habit..."
                  rows="3"
                />
              </div>
              
              <div className="form-group">
                <label>Frequency</label>
                <select
                  value={newHabit.frequency}
                  onChange={(e) => setNewHabit({...newHabit, frequency: e.target.value})}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Color</label>
                <div className="color-picker">
                  {HABIT_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      className={`color-option ${newHabit.color === color ? 'selected' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewHabit({...newHabit, color})}
                      title={color}
                    />
                  ))}
                </div>
              </div>
              
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowAddHabit(false)}>
                  <FiX />
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  <FiPlus />
                  Create Habit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Habit Modal */}
      {editingHabit && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Edit Habit</h3>
              <button className="close-btn" onClick={() => setEditingHabit(null)}>
                <FiX />
              </button>
            </div>
            
            <form onSubmit={handleUpdateHabit}>
              <div className="form-group">
                <label>Habit Name *</label>
                <input
                  type="text"
                  value={editingHabit.title}
                  onChange={(e) => setEditingHabit({...editingHabit, title: e.target.value})}
                  placeholder="e.g., Morning Exercise"
                  required
                  autoFocus
                />
              </div>
              
              <div className="form-group">
                <label>Description (Optional)</label>
                <textarea
                  value={editingHabit.description || ''}
                  onChange={(e) => setEditingHabit({...editingHabit, description: e.target.value})}
                  placeholder="Describe your habit..."
                  rows="3"
                />
              </div>
              
              <div className="form-group">
                <label>Frequency</label>
                <select
                  value={editingHabit.frequency}
                  onChange={(e) => setEditingHabit({...editingHabit, frequency: e.target.value})}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Color</label>
                <div className="color-picker">
                  {HABIT_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      className={`color-option ${editingHabit.color === color ? 'selected' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setEditingHabit({...editingHabit, color})}
                      title={color}
                    />
                  ))}
                </div>
              </div>
              
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setEditingHabit(null)}>
                  <FiX />
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  <FiSave />
                  Update Habit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 