from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, date, timedelta
import uuid
import os

app = Flask(__name__)
CORS(app)

# Use SQLite - no setup needed!
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///habits.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'dev-secret-key-change-in-production'

db = SQLAlchemy(app)

# Models
class User(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Habit(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    frequency = db.Column(db.String(20), nullable=False)  # daily, weekly, monthly
    target_days = db.Column(db.Integer, default=1)
    color = db.Column(db.String(7), default='#3B82F6')
    icon = db.Column(db.String(50), default='check-circle')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    user = db.relationship('User', backref=db.backref('habits', lazy=True))

class HabitCompletion(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    habit_id = db.Column(db.String(36), db.ForeignKey('habit.id'), nullable=False)
    completed_date = db.Column(db.Date, nullable=False, default=date.today)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    habit = db.relationship('Habit', backref=db.backref('completions', lazy=True))

class Streak(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    habit_id = db.Column(db.String(36), db.ForeignKey('habit.id'), nullable=False)
    current_streak = db.Column(db.Integer, default=0)
    longest_streak = db.Column(db.Integer, default=0)
    last_completed = db.Column(db.Date)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    habit = db.relationship('Habit', backref=db.backref('streaks', lazy=True))

# Create tables
with app.app_context():
    db.create_all()
    print("✅ Database created successfully!")

# Helper functions - FIXED VERSION
def update_streak(habit_id):
    today = date.today()
    yesterday = today - timedelta(days=1)
    
    streak = Streak.query.filter_by(habit_id=habit_id).first()
    if not streak:
        streak = Streak(habit_id=habit_id)
        db.session.add(streak)
    
    completions = HabitCompletion.query.filter_by(habit_id=habit_id)\
        .order_by(HabitCompletion.completed_date.desc()).all()
    
    if not completions:
        streak.current_streak = 0
        streak.last_completed = None
    else:
        last_completion = completions[0].completed_date
        
        # Ensure we're comparing date objects
        if isinstance(last_completion, str):
            last_completion = datetime.strptime(last_completion, '%Y-%m-%d').date()
        
        # Debug logging
        print(f"DEBUG - Last completion: {last_completion} (type: {type(last_completion)})")
        print(f"DEBUG - Today: {today} (type: {type(today)})")
        print(f"DEBUG - Yesterday: {yesterday} (type: {type(yesterday)})")
        
        # Check if last completion was today or yesterday
        if last_completion == today:
            # Already completed today, streak remains
            if streak.last_completed != today:
                streak.current_streak += 1
                streak.last_completed = today
        elif last_completion == yesterday:
            # Completed yesterday but not today, streak continues
            if streak.last_completed != today:
                streak.current_streak += 1
                streak.last_completed = last_completion
        else:
            # Gap in completion, reset streak
            days_since_last = (today - last_completion).days
            if days_since_last == 1:
                # Missed only one day
                streak.current_streak += 1
                streak.last_completed = last_completion
            else:
                # Gap of more than one day, reset streak
                streak.current_streak = 1
                streak.last_completed = last_completion
    
    if streak.current_streak > streak.longest_streak:
        streak.longest_streak = streak.current_streak
    
    db.session.commit()
    print(f"DEBUG - Updated streak: {streak.current_streak}")
    return streak

# Routes
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy'}), 200

@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        print("Registration data:", data)  # Debug
        
        # Check if user exists
        existing_user = User.query.filter_by(username=data['username']).first()
        if existing_user:
            return jsonify({'message': 'Username already exists'}), 400
        
        existing_email = User.query.filter_by(email=data['email']).first()
        if existing_email:
            return jsonify({'message': 'Email already exists'}), 400
        
        # Create user
        user = User(
            username=data['username'],
            email=data['email'],
            password=generate_password_hash(data['password'])
        )
        
        db.session.add(user)
        db.session.commit()
        
        return jsonify({
            'message': 'User created successfully',
            'user_id': user.id
        }), 201
        
    except Exception as e:
        print("Registration error:", str(e))
        return jsonify({'message': f'Error: {str(e)}'}), 500

@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        print("Login attempt for:", data['username'])  # Debug
        
        user = User.query.filter_by(username=data['username']).first()
        
        if user and check_password_hash(user.password, data['password']):
            return jsonify({
                'access_token': str(uuid.uuid4()),  # Simple token for now
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email
                }
            }), 200
        
        return jsonify({'message': 'Invalid username or password'}), 401
        
    except Exception as e:
        print("Login error:", str(e))
        return jsonify({'message': f'Error: {str(e)}'}), 500

@app.route('/api/habits', methods=['POST'])
def create_habit():
    try:
        data = request.get_json()
        print("Creating habit:", data)  # Debug
        
        habit = Habit(
            user_id=data['user_id'],
            title=data['title'],
            description=data.get('description', ''),
            frequency=data['frequency'],
            target_days=data.get('target_days', 1),
            color=data.get('color', '#3B82F6'),
            icon=data.get('icon', 'check-circle')
        )
        
        db.session.add(habit)
        db.session.commit()
        
        # Create initial streak
        streak = Streak(habit_id=habit.id)
        db.session.add(streak)
        db.session.commit()
        
        return jsonify({
            'id': habit.id,
            'message': 'Habit created successfully'
        }), 201
        
    except Exception as e:
        print("Create habit error:", str(e))
        return jsonify({'message': f'Error: {str(e)}'}), 500

@app.route('/api/users/<user_id>/habits', methods=['GET'])
def get_user_habits(user_id):
    try:
        habits = Habit.query.filter_by(user_id=user_id, is_active=True).all()
        
        habits_data = []
        for habit in habits:
            completions = HabitCompletion.query.filter_by(habit_id=habit.id).all()
            streak = Streak.query.filter_by(habit_id=habit.id).first()
            
            habits_data.append({
                'id': habit.id,
                'title': habit.title,
                'description': habit.description,
                'frequency': habit.frequency,
                'target_days': habit.target_days,
                'color': habit.color,
                'icon': habit.icon,
                'completions': [c.completed_date.isoformat() for c in completions],
                'current_streak': streak.current_streak if streak else 0,
                'longest_streak': streak.longest_streak if streak else 0,
                'created_at': habit.created_at.isoformat() if habit.created_at else None
            })
        
        return jsonify(habits_data), 200
        
    except Exception as e:
        print("Get habits error:", str(e))
        return jsonify({'message': f'Error: {str(e)}'}), 500

@app.route('/api/habits/<habit_id>/complete', methods=['POST'])
def complete_habit(habit_id):
    try:
        data = request.get_json()
        print("Complete habit data:", data)  # Debug
        
        # Check if habit exists
        habit = Habit.query.get(habit_id)
        if not habit:
            return jsonify({'message': 'Habit not found'}), 404
        
        # Parse the date
        completion_date_str = data.get('date')
        if completion_date_str:
            try:
                completion_date = datetime.strptime(completion_date_str, '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'message': 'Invalid date format. Use YYYY-MM-DD'}), 400
        else:
            completion_date = date.today()
        
        print(f"Completing habit for date: {completion_date}")  # Debug
        
        # Check if already completed for this date
        existing = HabitCompletion.query.filter_by(
            habit_id=habit_id,
            completed_date=completion_date
        ).first()
        
        if existing:
            return jsonify({'message': 'Already completed for this date'}), 400
        
        # Create new completion
        completion = HabitCompletion(
            habit_id=habit_id,
            completed_date=completion_date,
            notes=data.get('notes', '')
        )
        
        db.session.add(completion)
        db.session.commit()
        
        # Update streak
        streak = update_streak(habit_id)
        
        return jsonify({
            'message': 'Habit completed successfully',
            'streak': streak.current_streak
        }), 200
        
    except Exception as e:
        print("Complete habit error:", str(e))
        db.session.rollback()
        return jsonify({'message': f'Error: {str(e)}'}), 500

@app.route('/api/habits/<habit_id>/uncomplete', methods=['POST'])
def uncomplete_habit(habit_id):
    try:
        data = request.get_json()
        print("Uncomplete habit data:", data)  # Debug
        
        # Check if habit exists
        habit = Habit.query.get(habit_id)
        if not habit:
            return jsonify({'message': 'Habit not found'}), 404
        
        # Parse the date
        completion_date_str = data.get('date')
        if completion_date_str:
            try:
                completion_date = datetime.strptime(completion_date_str, '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'message': 'Invalid date format. Use YYYY-MM-DD'}), 400
        else:
            completion_date = date.today()
        
        print(f"Uncompleting habit for date: {completion_date}")  # Debug
        
        # Find and delete the completion
        completion = HabitCompletion.query.filter_by(
            habit_id=habit_id,
            completed_date=completion_date
        ).first()
        
        if completion:
            db.session.delete(completion)
            db.session.commit()
            
            # Update streak
            update_streak(habit_id)
            
            return jsonify({'message': 'Completion removed successfully'}), 200
        
        return jsonify({'message': 'Completion not found'}), 404
        
    except Exception as e:
        print("Uncomplete habit error:", str(e))
        db.session.rollback()
        return jsonify({'message': f'Error: {str(e)}'}), 500

@app.route('/api/users/<user_id>/stats', methods=['GET'])
def get_user_stats(user_id):
    try:
        # Total habits
        total_habits = Habit.query.filter_by(user_id=user_id, is_active=True).count()
        
        # Completed today
        today = date.today()
        completions_today = db.session.query(HabitCompletion)\
            .join(Habit)\
            .filter(Habit.user_id == user_id, HabitCompletion.completed_date == today)\
            .count()
        
        # Streaks
        streaks = Streak.query.join(Habit).filter(Habit.user_id == user_id).all()
        total_streak = sum(s.current_streak for s in streaks)
        longest_streak = max((s.longest_streak for s in streaks), default=0)
        
        return jsonify({
            'total_habits': total_habits,
            'completed_today': completions_today,
            'total_streak': total_streak,
            'longest_streak': longest_streak,
            'success_rate': round((completions_today / total_habits * 100) if total_habits > 0 else 0, 1)
        }), 200
        
    except Exception as e:
        print("Get stats error:", str(e))
        return jsonify({'message': f'Error: {str(e)}'}), 500
    
# Add these routes to your Flask app

@app.route('/api/habits/<habit_id>', methods=['GET'])
def get_habit(habit_id):
    """Get a specific habit by ID"""
    try:
        habit = Habit.query.get(habit_id)
        if not habit:
            return jsonify({'message': 'Habit not found'}), 404
        
        # Get completion dates
        completions = HabitCompletion.query.filter_by(habit_id=habit_id).all()
        streak = Streak.query.filter_by(habit_id=habit_id).first()
        
        habit_data = {
            'id': habit.id,
            'user_id': habit.user_id,
            'title': habit.title,
            'description': habit.description,
            'frequency': habit.frequency,
            'target_days': habit.target_days,
            'color': habit.color,
            'icon': habit.icon,
            'is_active': habit.is_active,
            'completions': [c.completed_date.isoformat() for c in completions],
            'current_streak': streak.current_streak if streak else 0,
            'longest_streak': streak.longest_streak if streak else 0,
            'created_at': habit.created_at.isoformat() if habit.created_at else None
        }
        
        return jsonify(habit_data), 200
        
    except Exception as e:
        print("Get habit error:", str(e))
        return jsonify({'message': f'Error: {str(e)}'}), 500

@app.route('/api/habits/<habit_id>', methods=['PUT'])
def update_habit(habit_id):
    """Update an existing habit"""
    try:
        data = request.get_json()
        print("Updating habit:", data)  # Debug
        
        # Check if habit exists
        habit = Habit.query.get(habit_id)
        if not habit:
            return jsonify({'message': 'Habit not found'}), 404
        
        # Check if user owns this habit (for security)
        # You might want to add user verification here
        
        # Update habit fields
        if 'title' in data:
            habit.title = data['title']
        if 'description' in data:
            habit.description = data['description']
        if 'frequency' in data:
            habit.frequency = data['frequency']
        if 'target_days' in data:
            habit.target_days = data['target_days']
        if 'color' in data:
            habit.color = data['color']
        if 'icon' in data:
            habit.icon = data['icon']
        if 'is_active' in data:
            habit.is_active = data['is_active']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Habit updated successfully',
            'habit_id': habit.id
        }), 200
        
    except Exception as e:
        print("Update habit error:", str(e))
        db.session.rollback()
        return jsonify({'message': f'Error: {str(e)}'}), 500

@app.route('/api/habits/<habit_id>', methods=['DELETE'])
def delete_habit(habit_id):
    """Delete a habit and all its related data"""
    try:
        print(f"Deleting habit: {habit_id}")  # Debug
        
        # Check if habit exists
        habit = Habit.query.get(habit_id)
        if not habit:
            return jsonify({'message': 'Habit not found'}), 404
        
        # Check if user owns this habit (for security)
        # You might want to add user verification here
        
        # Delete all related completions first
        completions_deleted = HabitCompletion.query.filter_by(habit_id=habit_id).delete()
        print(f"Deleted {completions_deleted} completions")
        
        # Delete streak record
        streak_deleted = Streak.query.filter_by(habit_id=habit_id).delete()
        print(f"Deleted {streak_deleted} streak record")
        
        # Finally delete the habit
        db.session.delete(habit)
        db.session.commit()
        
        return jsonify({
            'message': 'Habit deleted successfully',
            'completions_deleted': completions_deleted
        }), 200
        
    except Exception as e:
        print("Delete habit error:", str(e))
        db.session.rollback()
        return jsonify({'message': f'Error: {str(e)}'}), 500

@app.route('/api/habits/<habit_id>/toggle', methods=['POST'])
def toggle_habit_active(habit_id):
    """Toggle habit active status (archive/unarchive)"""
    try:
        data = request.get_json()
        print(f"Toggling habit active status: {habit_id}", data)  # Debug
        
        habit = Habit.query.get(habit_id)
        if not habit:
            return jsonify({'message': 'Habit not found'}), 404
        
        # Toggle is_active status
        habit.is_active = data.get('is_active', not habit.is_active)
        db.session.commit()
        
        status = "activated" if habit.is_active else "archived"
        return jsonify({
            'message': f'Habit {status} successfully',
            'is_active': habit.is_active
        }), 200
        
    except Exception as e:
        print("Toggle habit error:", str(e))
        db.session.rollback()
        return jsonify({'message': f'Error: {str(e)}'}), 500

if __name__ == '__main__':
    print("🚀 Starting Habit Tracker Backend...")
    print("📊 Database: habits.db (SQLite)")
    print("🌐 API: https://habittracker-133y.onrender.com")
    print("✅ Health check: https://habittracker-133y.onrender.com/api/health")
    app.run(debug=True, port=5000)

    # CORS headers middleware
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response