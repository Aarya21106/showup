import streamlit as st
import sqlite3
import subprocess
import os
import time
import json
import pandas as pd
from datetime import datetime
from PIL import Image

# Set page layout to wide and title
st.set_page_config(
    page_title="ShowUp Conversational Sandbox",
    layout="wide",
    initial_sidebar_state="expanded"
)

# SQLite DB Path
DB_PATH = os.path.join(os.getcwd(), "data", "showup.db")

# Custom CSS for premium dark theme look, chat bubbles, and clean layout
st.markdown("""
<style>
    /* Gradient Header */
    .gradient-header {
        background: linear-gradient(135deg, #00A884, #005E54);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-weight: 800;
        font-size: 2.2rem;
        margin-bottom: 0.5rem;
    }
    
    /* Sleek User Profile Card */
    .profile-card {
        background-color: #1E2D3B;
        border-radius: 12px;
        padding: 15px;
        margin-bottom: 15px;
        border: 1px solid #2B3C4D;
    }
    
    /* Chat Bubble styling */
    .chat-container {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 10px;
        background-color: #0B141A;
        border-radius: 16px;
        min-height: 400px;
        max-height: 600px;
        overflow-y: auto;
        border: 1px solid #222D34;
        margin-bottom: 20px;
    }
    
    .chat-bubble {
        padding: 12px 16px;
        border-radius: 12px;
        max-width: 80%;
        line-height: 1.4;
        font-size: 0.95rem;
        word-wrap: break-word;
        position: relative;
    }
    
    .chat-user {
        background: linear-gradient(135deg, #005C4B, #027A64);
        color: #E9EDEF;
        align-self: flex-end;
        border-bottom-right-radius: 2px;
    }
    
    .chat-bot {
        background-color: #202C33;
        color: #E9EDEF;
        align-self: flex-start;
        border-bottom-left-radius: 2px;
        border: 1px solid #2B3C4D;
    }
    
    .chat-meta {
        font-size: 0.75rem;
        color: #8696A0;
        margin-top: 4px;
        text-align: right;
    }
    
    /* Database metrics cards */
    .metric-box {
        background-color: #111B21;
        border-left: 4px solid #00A884;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 10px;
    }
    
    .metric-box-title {
        font-size: 0.8rem;
        color: #8696A0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    
    .metric-box-val {
        font-size: 1.1rem;
        font-weight: bold;
        color: #E9EDEF;
    }
</style>
""", unsafe_allow_html=True)

# --- Helper DB Functions ---
def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def fetch_all_users():
    if not os.path.exists(DB_PATH):
        return []
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, phone, name, state FROM users ORDER BY created_at DESC")
            return [dict(row) for row in cursor.fetchall()]
    except Exception as e:
        st.error(f"Error fetching users: {e}")
        return []

def fetch_user_by_phone(phone):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE phone = ?", (phone,))
            row = cursor.fetchone()
            return dict(row) if row else None
    except Exception as e:
        st.error(f"Error fetching user: {e}")
        return None

def fetch_chat_history(phone):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            # Get user id first
            cursor.execute("SELECT id FROM users WHERE phone = ?", (phone,))
            user_row = cursor.fetchone()
            if not user_row:
                return []
            user_id = user_row[0]
            cursor.execute(
                "SELECT role, text, created_at FROM chat_messages WHERE user_id = ? ORDER BY id ASC",
                (user_id,)
            )
            return [dict(row) for row in cursor.fetchall()]
    except Exception as e:
        st.error(f"Error fetching chat history: {e}")
        return []

def fetch_checkins(phone):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE phone = ?", (phone,))
            user_row = cursor.fetchone()
            if not user_row:
                return pd.DataFrame()
            user_id = user_row[0]
            df = pd.read_sql_query(
                "SELECT date, activity_type, distance_km, duration_minutes, pace_min_per_km, status, gemini_reason, gesture, photo_ref FROM checkins WHERE user_id = ? ORDER BY date DESC",
                conn
            )
            return df
    except Exception as e:
        st.error(f"Error fetching checkins: {e}")
        return pd.DataFrame()

def fetch_nutrition(phone):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE phone = ?", (phone,))
            user_row = cursor.fetchone()
            if not user_row:
                return pd.DataFrame()
            user_id = user_row[0]
            df = pd.read_sql_query(
                "SELECT date, food_item, weight_g, calories, protein, carbs, fat FROM nutrition_logs WHERE user_id = ? ORDER BY date DESC, id DESC",
                conn
            )
            return df
    except Exception as e:
        st.error(f"Error fetching nutrition logs: {e}")
        return pd.DataFrame()

def fetch_summaries(phone):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE phone = ?", (phone,))
            user_row = cursor.fetchone()
            if not user_row:
                return pd.DataFrame()
            user_id = user_row[0]
            df = pd.read_sql_query(
                "SELECT date, summary, follow_up_worthy, follow_up_date, follow_up_resolved FROM daily_summaries WHERE user_id = ? ORDER BY date DESC",
                conn
            )
            return df
    except Exception as e:
        st.error(f"Error fetching daily summaries: {e}")
        return pd.DataFrame()


# --- CLI execution runners ---
def run_cli_command(action, phone, message="", media_path=""):
    cmd = ["node", "scripts/simulate_message.js", action, phone]
    if action == "send":
        cmd.append(message)
        if media_path:
            cmd.append(media_path)
            
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return True, result.stdout
    except subprocess.CalledProcessError as e:
        return False, f"CLI Error:\nStdout: {e.stdout}\nStderr: {e.stderr}"

# --- Layout Rendering ---
st.markdown("<div class='gradient-header'>ShowUp Conversational Sandbox</div>", unsafe_allow_html=True)
st.caption("Side-by-side chatbot tester and database visual explorer.")

# Ensure temp directory exists for uploads
os.makedirs("generated", exist_ok=True)

# Load users
all_users = fetch_all_users()
user_options = {f"{u['name'] or 'Unknown'} ({u['phone']})": u['phone'] for u in all_users}
user_options["[+] Create New User / Add Phone Number"] = "NEW"

# Sidebar: User selection & profile state
with st.sidebar:
    st.markdown("### 📱 Active Session User")
    selected_label = st.selectbox(
        "Select User Profile",
        options=list(user_options.keys())
    )
    
    selected_phone = user_options[selected_label]
    
    if selected_phone == "NEW":
        new_phone = st.text_input("Enter WhatsApp Phone JID (e.g. whatsapp:+919876543210)", value="whatsapp:+91")
        if st.button("Initialize User Session"):
            if new_phone.startswith("whatsapp:+") and len(new_phone) > 12:
                # Run default greeting
                success, output = run_cli_command("send", new_phone, "Hi")
                if success:
                    st.success("User session initialized!")
                    st.rerun()
                else:
                    st.error(output)
            else:
                st.warning("Please format phone number as: whatsapp:+[country][number] (e.g. whatsapp:+919876543210)")
        selected_phone = None
        
    if selected_phone:
        user_data = fetch_user_by_phone(selected_phone)
        
        if user_data:
            st.markdown("#### ⚙️ Session Actions")
            col1, col2 = st.columns(2)
            with col1:
                if st.button("🔄 Refresh Data", use_container_width=True):
                    st.rerun()
            with col2:
                if st.button("⚠️ Reset Session", use_container_width=True):
                    success, output = run_cli_command("reset", selected_phone)
                    if success:
                        st.success("User progress wiped!")
                        time.sleep(1)
                        st.rerun()
                    else:
                        st.error(output)
            
            st.markdown("---")
            st.markdown("#### 👤 Profile Database Record")
            
            # Helper to draw metric box
            def draw_db_metric(title, val):
                st.markdown(f"""
                <div class='metric-box'>
                    <div class='metric-box-title'>{title}</div>
                    <div class='metric-box-val'>{val if val is not None else '<i>Not set</i>'}</div>
                </div>
                """, unsafe_allow_html=True)
                
            draw_db_metric("State / Step", user_data.get('state'))
            draw_db_metric("Name", user_data.get('name'))
            draw_db_metric("Language Mode", user_data.get('language'))
            draw_db_metric("Activity Target", user_data.get('activity'))
            draw_db_metric("Streak 🔥", f"{user_data.get('streak', 0)} days (Missed: {user_data.get('missed_count', 0)})")
            
            if user_data.get('activity') in ['running', 'walking', 'cycling']:
                draw_db_metric("Cardio App", user_data.get('fitness_app'))
                draw_db_metric("Goal Distance / Session", f"{user_data.get('weekly_goal_distance_km')} km" if user_data.get('weekly_goal_distance_km') is not None else None)
            
            draw_db_metric("Deposit Status 💳", user_data.get('deposit_status'))
            draw_db_metric("Timetable Schedule", user_data.get('timetable'))
            draw_db_metric("Allergies 🚫", user_data.get('allergy'))
            
            # Show weekly plan JSON if set
            if user_data.get('weekly_plan'):
                try:
                    plan = json.loads(user_data.get('weekly_plan'))
                    st.markdown("**Weekly Plan JSON:**")
                    st.json(plan)
                except:
                    st.markdown(f"**Weekly Plan:** {user_data.get('weekly_plan')}")

# Main interface columns
if selected_phone:
    chat_col, db_col = st.columns([3, 2])
    
    # ── COLUMN 1: CHATBOT INTERFACE ──
    with chat_col:
        st.subheader("💬 Chat Simulation")
        
        # Fetch and render chat history
        chat_history = fetch_chat_history(selected_phone)
        
        # Render messages inside a styled chat container
        chat_html = "<div class='chat-container'>"
        for msg in chat_history:
            role_class = "chat-user" if msg['role'] == 'user' else "chat-bot"
            # Format time if available
            timestamp_str = ""
            if msg.get('created_at'):
                try:
                    dt = datetime.strptime(msg['created_at'], "%Y-%m-%d %H:%M:%S")
                    timestamp_str = dt.strftime("%I:%M %p")
                except:
                    timestamp_str = str(msg['created_at'])
            
            chat_html += f"""
            <div class='chat-bubble {role_class}'>
                {msg['text'].replace('\n', '<br>')}
                <div class='chat-meta'>{timestamp_str}</div>
            </div>
            """
        chat_html += "</div>"
        st.markdown(chat_html, unsafe_allow_html=True)
        
        # Message composer
        with st.form("chat_form", clear_on_submit=True):
            user_msg = st.text_input("Type your response to the coach:", placeholder="Type a message or command (e.g. 'ok', 'paid', 'yes')")
            
            # Simulate photo uploads
            uploaded_file = st.file_uploader(
                "Attach a Workout / Cardio Screenshot to check in:",
                type=["png", "jpg", "jpeg", "webp"],
                help="Legitimate Strava, Garmin, Apple Fitness, Samsung Health screenshots are verified by the vision system."
            )
            
            submit = st.form_submit_form_button = st.form_submit_button("Send to Coach 📲")
            
            if submit:
                media_path = ""
                if uploaded_file:
                    # Save upload to a local file inside generated/
                    filename = f"temp_upload_{int(time.time())}_{uploaded_file.name}"
                    local_path = os.path.join(os.getcwd(), "generated", filename)
                    with open(local_path, "wb") as f:
                        f.write(uploaded_file.getbuffer())
                    media_path = local_path
                
                if user_msg or media_path:
                    with st.spinner("Coach is replying..."):
                        success, output = run_cli_command("send", selected_phone, user_msg, media_path)
                        if success:
                            st.rerun()
                        else:
                            st.error(output)
                            
    # ── COLUMN 2: DATABASE EXPLORER ──
    with db_col:
        st.subheader("🔍 Database Explorer")
        
        tab_checkins, tab_nutrition, tab_summaries = st.tabs(["📋 Checkins Logs", "🥗 Nutrition Logs", "📝 Daily Summaries"])
        
        with tab_checkins:
            st.markdown("#### Accepted and Pending Checkin Records")
            df_checkins = fetch_checkins(selected_phone)
            if not df_checkins.empty:
                st.dataframe(
                    df_checkins,
                    column_config={
                        "photo_ref": st.column_config.LinkColumn("Photo Reference"),
                        "distance_km": st.column_config.NumberColumn("Distance (km)", format="%.2f km"),
                        "duration_minutes": st.column_config.NumberColumn("Duration (min)", format="%.1f min"),
                        "pace_min_per_km": st.column_config.NumberColumn("Pace", format="%.2f min/km"),
                    },
                    use_container_width=True,
                    hide_index=True
                )
            else:
                st.info("No checkins logged yet.")
                
        with tab_nutrition:
            st.markdown("#### Meal and Calorie Tracking")
            df_nutri = fetch_nutrition(selected_phone)
            if not df_nutri.empty:
                st.dataframe(
                    df_nutri,
                    use_container_width=True,
                    hide_index=True
                )
            else:
                st.info("No nutrition items logged yet.")
                
        with tab_summaries:
            st.markdown("#### Daily Insights & Followup Tasks")
            df_sum = fetch_summaries(selected_phone)
            if not df_sum.empty:
                st.dataframe(
                    df_sum,
                    column_config={
                        "follow_up_worthy": st.column_config.CheckboxColumn("Follow-up Worthy"),
                        "follow_up_resolved": st.column_config.CheckboxColumn("Resolved"),
                    },
                    use_container_width=True,
                    hide_index=True
                )
            else:
                st.info("No daily summaries generated yet.")
else:
    st.info("👈 Please select or create a user session from the sidebar to begin testing!")
