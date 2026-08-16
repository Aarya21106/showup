import streamlit as st
import sqlite3
import subprocess
import os
import time
import json
import pandas as pd
from datetime import datetime
import html as html_mod

# ─── Page Config ───
st.set_page_config(
    page_title="ShowUp – WhatsApp Sandbox",
    page_icon="💬",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ─── Constants ───
DB_PATH = os.path.join(os.getcwd(), "data", "showup.db")
os.makedirs("generated", exist_ok=True)

# ─── WhatsApp-Clone CSS ───
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

/* ── Global Reset ── */
* { font-family: 'Inter', sans-serif; }
[data-testid="stMainBlockContainer"] { padding-top: 0 !important; }
[data-testid="stVerticalBlock"] { gap: 0 !important; }
header[data-testid="stHeader"] { display: none !important; }

/* ── Hide Streamlit branding ── */
#MainMenu, footer, .stDeployButton { display: none !important; }

/* ── Sidebar styling ── */
[data-testid="stSidebar"] {
    background: #0a0f14 !important;
    border-right: 1px solid #1a2733 !important;
}
[data-testid="stSidebar"] [data-testid="stMarkdownContainer"] p,
[data-testid="stSidebar"] [data-testid="stMarkdownContainer"] li,
[data-testid="stSidebar"] label {
    color: #aebac1 !important;
    font-size: 0.85rem !important;
}
[data-testid="stSidebar"] h1, [data-testid="stSidebar"] h2,
[data-testid="stSidebar"] h3, [data-testid="stSidebar"] h4 {
    color: #e9edef !important;
}

/* ── WhatsApp Phone Frame ── */
.wa-phone {
    max-width: 420px;
    margin: 20px auto;
    border-radius: 28px;
    overflow: hidden;
    box-shadow: 0 20px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05);
    border: 2px solid #1a2733;
    background: #0b141a;
    position: relative;
}

/* ── Top Bar ── */
.wa-topbar {
    background: linear-gradient(135deg, #1f2c34, #1a2730);
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid #233040;
    position: sticky;
    top: 0;
    z-index: 10;
}
.wa-topbar-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #00a884, #005c4b);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    color: white;
    font-weight: 700;
    flex-shrink: 0;
}
.wa-topbar-info { flex: 1; }
.wa-topbar-name {
    color: #e9edef;
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.2;
}
.wa-topbar-status {
    color: #8696a0;
    font-size: 0.75rem;
    line-height: 1.2;
}
.wa-topbar-icons {
    display: flex;
    gap: 18px;
    color: #aebac1;
    font-size: 1.1rem;
}

/* ── Chat Area ── */
.wa-chat {
    background-color: #0b141a;
    background-image:
        radial-gradient(ellipse at 20% 50%, rgba(0,168,132,0.03) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 20%, rgba(0,92,75,0.04) 0%, transparent 50%);
    min-height: 500px;
    max-height: 580px;
    overflow-y: auto;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    scroll-behavior: smooth;
}

/* ── Date Badge ── */
.wa-date-badge {
    align-self: center;
    background: #182229;
    color: #8696a0;
    font-size: 0.7rem;
    padding: 5px 12px;
    border-radius: 8px;
    margin: 8px 0;
    font-weight: 500;
    letter-spacing: 0.3px;
}

/* ── Chat Bubbles ── */
.wa-msg {
    max-width: 82%;
    padding: 7px 10px 4px 10px;
    border-radius: 10px;
    font-size: 0.88rem;
    line-height: 1.45;
    word-wrap: break-word;
    position: relative;
    animation: fadeSlideIn 0.25s ease-out;
}
@keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
}

.wa-msg-user {
    background: linear-gradient(135deg, #005c4b, #00503f);
    color: #e9edef;
    align-self: flex-end;
    border-bottom-right-radius: 3px;
    margin-left: auto;
}
.wa-msg-bot {
    background: #1f2c34;
    color: #e9edef;
    align-self: flex-start;
    border-bottom-left-radius: 3px;
    border: 1px solid #233040;
}

.wa-msg-time {
    font-size: 0.65rem;
    color: rgba(134,150,160,0.85);
    text-align: right;
    margin-top: 3px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
}
/* Double check marks for sent messages */
.wa-msg-user .wa-msg-time::after {
    content: '✓✓';
    color: #53bdeb;
    font-size: 0.7rem;
    font-weight: 700;
}

/* ── Input Bar ── */
.wa-inputbar {
    background: #1f2c34;
    padding: 8px 10px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-top: 1px solid #233040;
}

/* ── Empty State ── */
.wa-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 400px;
    gap: 16px;
    color: #8696a0;
}
.wa-empty-icon {
    font-size: 4rem;
    opacity: 0.3;
}
.wa-empty-text {
    font-size: 1rem;
    font-weight: 500;
    color: #aebac1;
}
.wa-empty-sub {
    font-size: 0.8rem;
    color: #667781;
    text-align: center;
    max-width: 280px;
}

/* ── Typing Indicator ── */
.wa-typing {
    align-self: flex-start;
    background: #1f2c34;
    padding: 10px 16px;
    border-radius: 10px;
    border-bottom-left-radius: 3px;
    border: 1px solid #233040;
    display: flex;
    gap: 5px;
    margin-top: 4px;
}
.wa-typing-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #8696a0;
    animation: typingBounce 1.4s infinite ease-in-out;
}
.wa-typing-dot:nth-child(2) { animation-delay: 0.2s; }
.wa-typing-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes typingBounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
    30% { transform: translateY(-6px); opacity: 1; }
}

/* ── Debug Panel Styles ── */
.debug-header {
    background: linear-gradient(135deg, #ff6b35, #e84118);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    font-weight: 800;
    font-size: 1.1rem;
    margin: 8px 0 4px 0;
}
.debug-metric {
    background: #111b21;
    border-left: 3px solid #00a884;
    border-radius: 6px;
    padding: 8px 12px;
    margin-bottom: 6px;
}
.debug-metric-label {
    font-size: 0.65rem;
    color: #667781;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    font-weight: 600;
}
.debug-metric-value {
    font-size: 0.9rem;
    color: #e9edef;
    font-weight: 500;
    margin-top: 1px;
}
.debug-table-count {
    display: inline-block;
    background: #00a884;
    color: #0b141a;
    font-size: 0.7rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 10px;
    margin-left: 6px;
}
.debug-section {
    background: #0d1418;
    border: 1px solid #1a2733;
    border-radius: 8px;
    padding: 10px;
    margin: 8px 0;
}

/* ── Streamlit form overrides ── */
[data-testid="stForm"] {
    border: none !important;
    padding: 0 !important;
    background: transparent !important;
}
div[data-testid="stTextInput"] input {
    background: #2a3942 !important;
    border: none !important;
    border-radius: 20px !important;
    color: #e9edef !important;
    padding: 10px 16px !important;
    font-size: 0.9rem !important;
}
div[data-testid="stTextInput"] input::placeholder {
    color: #8696a0 !important;
}
button[kind="secondaryFormSubmit"], button[data-testid="stFormSubmitButton"] > button {
    background: linear-gradient(135deg, #00a884, #005c4b) !important;
    color: white !important;
    border: none !important;
    border-radius: 50% !important;
    width: 44px !important;
    height: 44px !important;
    min-width: 44px !important;
    padding: 0 !important;
    font-size: 1.2rem !important;
}
</style>
""", unsafe_allow_html=True)


# ═══════════════════════════════════════════
#  DATABASE HELPERS
# ═══════════════════════════════════════════

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def safe_query(query, params=None):
    """Run a query and return results as list of dicts."""
    if not os.path.exists(DB_PATH):
        return []
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            return [dict(row) for row in cursor.fetchall()]
    except Exception as e:
        st.error(f"DB Error: {e}")
        return []

def safe_query_df(query, params=None):
    """Run a query and return a DataFrame."""
    if not os.path.exists(DB_PATH):
        return pd.DataFrame()
    try:
        with get_db() as conn:
            return pd.read_sql_query(query, conn, params=params)
    except Exception as e:
        st.error(f"DB Error: {e}")
        return pd.DataFrame()

def fetch_all_users():
    return safe_query("SELECT id, phone, name, state, activity, streak, missed_count, created_at FROM users ORDER BY created_at DESC")

def fetch_user_by_phone(phone):
    rows = safe_query("SELECT * FROM users WHERE phone = ?", (phone,))
    return rows[0] if rows else None

def fetch_chat_history(phone):
    return safe_query(
        "SELECT cm.role, cm.text, cm.created_at FROM chat_messages cm "
        "JOIN users u ON cm.user_id = u.id WHERE u.phone = ? ORDER BY cm.id ASC",
        (phone,)
    )

def fetch_table_data(table_name):
    return safe_query_df(f"SELECT * FROM {table_name} ORDER BY id DESC LIMIT 200")

def fetch_all_table_names():
    rows = safe_query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    return [r['name'] for r in rows]

def fetch_table_count(table_name):
    rows = safe_query(f"SELECT COUNT(*) as cnt FROM {table_name}")
    return rows[0]['cnt'] if rows else 0


# ═══════════════════════════════════════════
#  CLI RUNNER
# ═══════════════════════════════════════════

def run_cli(action, phone, message="", media_path=""):
    cmd = ["node", "scripts/simulate_message.js", action, phone]
    if action == "send":
        cmd.append(message)
        if media_path:
            cmd.append(media_path)
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=60)
        return True, result.stdout
    except subprocess.TimeoutExpired:
        return False, "Command timed out after 60s"
    except subprocess.CalledProcessError as e:
        return False, f"Error:\n{e.stdout}\n{e.stderr}"


# ═══════════════════════════════════════════
#  SIDEBAR — USER SELECT + DEBUG MODE
# ═══════════════════════════════════════════

all_users = fetch_all_users()
user_map = {f"{u.get('name') or 'Unknown'} ({u['phone']})": u['phone'] for u in all_users}
user_map["➕ New User"] = "NEW"

with st.sidebar:
    # ── User Selection ──
    st.markdown("### 📱 Select User")
    selected_label = st.selectbox("User", list(user_map.keys()), label_visibility="collapsed")
    selected_phone = user_map[selected_label]

    if selected_phone == "NEW":
        new_phone = st.text_input("WhatsApp JID", value="whatsapp:+91", placeholder="whatsapp:+919876543210")
        if st.button("🚀 Start Session", width="stretch"):
            if new_phone.startswith("whatsapp:+") and len(new_phone) > 12:
                ok, out = run_cli("send", new_phone, "Hi")
                if ok:
                    st.success("Session started!")
                    time.sleep(0.5)
                    st.rerun()
                else:
                    st.error(out)
            else:
                st.warning("Format: whatsapp:+[country][number]")
        selected_phone = None

    # ── Session Actions ──
    if selected_phone:
        user_data = fetch_user_by_phone(selected_phone)
        c1, c2 = st.columns(2)
        with c1:
            if st.button("🔄 Refresh", use_container_width=True):
                st.rerun()
        with c2:
            if st.button("🗑️ Reset", use_container_width=True):
                ok, out = run_cli("reset", selected_phone)
                if ok:
                    st.success("Reset!")
                    time.sleep(0.5)
                    st.rerun()
                else:
                    st.error(out)

    st.markdown("---")

    # ── DEBUG MODE ──
    st.markdown("<div class='debug-header'>🐛 DEBUG MODE</div>", unsafe_allow_html=True)
    debug_mode = st.toggle("Enable Debug Panel", value=True)

    if debug_mode:
        # ── User Profile Card ──
        if selected_phone and user_data:
            st.markdown("#### 👤 User Profile")

            def metric(label, value):
                val = value if value is not None else "<em style='color:#667781'>null</em>"
                st.markdown(f"""<div class='debug-metric'>
                    <div class='debug-metric-label'>{label}</div>
                    <div class='debug-metric-value'>{val}</div>
                </div>""", unsafe_allow_html=True)

            metric("ID", user_data.get('id'))
            metric("Phone", user_data.get('phone'))
            metric("Name", user_data.get('name'))
            metric("State", user_data.get('state'))
            metric("Activity", user_data.get('activity'))
            metric("Language", user_data.get('language'))
            metric("Tier", user_data.get('tier'))
            metric("Streak 🔥", f"{user_data.get('streak', 0)} days")
            metric("Missed", user_data.get('missed_count', 0))
            metric("Deposit", user_data.get('deposit_status'))
            metric("Days Count", user_data.get('day_count'))
            metric("Started At", user_data.get('started_at'))
            metric("Height", user_data.get('height'))
            metric("Weight", user_data.get('weight'))
            metric("Goal", user_data.get('goal'))
            metric("Target Calories", user_data.get('target_calories'))
            metric("Allergy", user_data.get('allergy'))
            metric("Timetable", user_data.get('timetable'))
            metric("Fitness App", user_data.get('fitness_app'))
            metric("Goal Distance/wk", f"{user_data.get('weekly_goal_distance_km')} km" if user_data.get('weekly_goal_distance_km') else None)
            metric("Cuisine Region", user_data.get('cuisine_region'))
            metric("Checkin Time", user_data.get('checkin_time'))
            metric("Commitment Score", user_data.get('commitment_score'))
            metric("Current Gesture", user_data.get('current_gesture'))

            # Profile JSON
            if user_data.get('profile_json') and user_data['profile_json'] != '{}':
                with st.expander("📋 Profile JSON"):
                    try:
                        st.json(json.loads(user_data['profile_json']))
                    except:
                        st.code(user_data['profile_json'])

            # Weekly Plan
            if user_data.get('weekly_plan'):
                with st.expander("📅 Weekly Plan"):
                    try:
                        st.json(json.loads(user_data['weekly_plan']))
                    except:
                        st.code(user_data['weekly_plan'])

            # Onboarding History
            if user_data.get('onboarding_history') and user_data['onboarding_history'] != '[]':
                with st.expander("📜 Onboarding History"):
                    try:
                        st.json(json.loads(user_data['onboarding_history']))
                    except:
                        st.code(user_data['onboarding_history'])

        st.markdown("---")

        # ── All Tables Explorer ──
        st.markdown("#### 🗄️ Database Tables")
        tables = fetch_all_table_names()

        for tbl in tables:
            count = fetch_table_count(tbl)
            with st.expander(f"📊 {tbl}  ({count} rows)"):
                df = fetch_table_data(tbl)
                if not df.empty:
                    st.dataframe(df, use_container_width=True, hide_index=True, height=300)
                else:
                    st.caption("Empty table")

        st.markdown("---")

        # ── All Users Overview ──
        st.markdown("#### 👥 All Users")
        if all_users:
            for u in all_users:
                name_display = u.get('name') or 'Unknown'
                state_display = u.get('state', '?')
                streak = u.get('streak', 0)
                st.markdown(f"""<div class='debug-section'>
                    <div style='color:#e9edef;font-weight:600;font-size:0.85rem'>{name_display}</div>
                    <div style='color:#8696a0;font-size:0.72rem;margin-top:2px'>{u['phone']}</div>
                    <div style='color:#00a884;font-size:0.72rem;margin-top:2px'>State: {state_display} · Streak: {streak}🔥</div>
                </div>""", unsafe_allow_html=True)
        else:
            st.caption("No users yet")


# ═══════════════════════════════════════════
#  MAIN — WHATSAPP PHONE UI
# ═══════════════════════════════════════════

if selected_phone:
    user_data = fetch_user_by_phone(selected_phone)
    user_name = (user_data.get('name') if user_data else None) or "User"
    user_initial = user_name[0].upper() if user_name else "?"
    user_state = (user_data.get('state') if user_data else None) or "unknown"

    # ── Build entire phone HTML in one shot ──
    chat_history = fetch_chat_history(selected_phone)

    # CSS must be embedded because st.html() renders in an iframe
    phone_css = """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', sans-serif; }
    body { background: transparent; }
    .wa-phone {
        max-width: 420px; margin: 0 auto; border-radius: 28px; overflow: hidden;
        box-shadow: 0 20px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05);
        border: 2px solid #1a2733; background: #0b141a;
    }
    .wa-topbar {
        background: linear-gradient(135deg, #1f2c34, #1a2730);
        padding: 12px 16px; display: flex; align-items: center; gap: 12px;
        border-bottom: 1px solid #233040;
    }
    .wa-topbar-back { color: #aebac1; font-size: 1.2rem; }
    .wa-topbar-avatar {
        width: 40px; height: 40px; border-radius: 50%;
        background: linear-gradient(135deg, #00a884, #005c4b);
        display: flex; align-items: center; justify-content: center;
        font-size: 1.1rem; color: white; font-weight: 700; flex-shrink: 0;
    }
    .wa-topbar-info { flex: 1; }
    .wa-topbar-name { color: #e9edef; font-size: 1rem; font-weight: 600; line-height: 1.2; }
    .wa-topbar-status { color: #8696a0; font-size: 0.75rem; line-height: 1.2; }
    .wa-topbar-icons { display: flex; gap: 18px; color: #aebac1; font-size: 1.1rem; }
    .wa-chat {
        background-color: #0b141a;
        background-image:
            radial-gradient(ellipse at 20% 50%, rgba(0,168,132,0.03) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 20%, rgba(0,92,75,0.04) 0%, transparent 50%);
        min-height: 500px; max-height: 580px; overflow-y: auto;
        padding: 12px 14px; display: flex; flex-direction: column; gap: 4px;
        scroll-behavior: smooth;
    }
    .wa-date-badge {
        align-self: center; background: #182229; color: #8696a0;
        font-size: 0.7rem; padding: 5px 12px; border-radius: 8px;
        margin: 8px 0; font-weight: 500; letter-spacing: 0.3px;
    }
    .wa-msg {
        max-width: 82%; padding: 7px 10px 4px 10px; border-radius: 10px;
        font-size: 0.88rem; line-height: 1.45; word-wrap: break-word;
        position: relative; animation: fadeSlideIn 0.25s ease-out;
    }
    @keyframes fadeSlideIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
    }
    .wa-msg-user {
        background: linear-gradient(135deg, #005c4b, #00503f); color: #e9edef;
        align-self: flex-end; border-bottom-right-radius: 3px; margin-left: auto;
    }
    .wa-msg-bot {
        background: #1f2c34; color: #e9edef; align-self: flex-start;
        border-bottom-left-radius: 3px; border: 1px solid #233040;
    }
    .wa-msg-time {
        font-size: 0.65rem; color: rgba(134,150,160,0.85); text-align: right;
        margin-top: 3px; display: flex; align-items: center; justify-content: flex-end; gap: 4px;
    }
    .wa-msg-user .wa-msg-time::after {
        content: '✓✓'; color: #53bdeb; font-size: 0.7rem; font-weight: 700;
    }
    .wa-empty {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        height: 400px; gap: 16px; color: #8696a0;
    }
    .wa-empty-icon { font-size: 4rem; opacity: 0.3; }
    .wa-empty-text { font-size: 1rem; font-weight: 500; color: #aebac1; }
    .wa-empty-sub { font-size: 0.8rem; color: #667781; text-align: center; max-width: 280px; }
    </style>
    """

    phone_html = phone_css + f"""
    <div class="wa-phone">
        <div class="wa-topbar">
            <div class="wa-topbar-back">←</div>
            <div class="wa-topbar-avatar">{user_initial}</div>
            <div class="wa-topbar-info">
                <div class="wa-topbar-name">ShowUp Coach</div>
                <div class="wa-topbar-status">online · {user_state}</div>
            </div>
            <div class="wa-topbar-icons">📹 📞 ⋮</div>
        </div>
        <div class="wa-chat" id="wa-chat-scroll">
    """

    if not chat_history:
        phone_html += """
        <div class="wa-empty">
            <div class="wa-empty-icon">💬</div>
            <div class="wa-empty-text">No messages yet</div>
            <div class="wa-empty-sub">Send "Hi" to start your conversation with the ShowUp Coach</div>
        </div>
        """
    else:
        last_date = None
        for msg in chat_history:
            msg_date = ""
            timestamp_str = ""
            if msg.get('created_at'):
                try:
                    dt = datetime.strptime(msg['created_at'], "%Y-%m-%d %H:%M:%S")
                    msg_date = dt.strftime("%B %d, %Y")
                    timestamp_str = dt.strftime("%I:%M %p")
                except:
                    timestamp_str = str(msg['created_at'])

            if msg_date and msg_date != last_date:
                phone_html += f'<div class="wa-date-badge">{msg_date}</div>'
                last_date = msg_date

            role_class = "wa-msg-user" if msg['role'] == 'user' else "wa-msg-bot"
            text = html_mod.escape(msg['text']).replace('\n', '<br>')

            phone_html += f"""
            <div class="wa-msg {role_class}">
                {text}
                <div class="wa-msg-time">{timestamp_str}</div>
            </div>
            """

    phone_html += """
        </div>
    </div>
    <script>
        var chatEl = document.getElementById('wa-chat-scroll');
        if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
    </script>
    """

    st.html(phone_html)

    # ── Message Input (outside the HTML block, as Streamlit widget) ──
    with st.form("wa_send_form", clear_on_submit=True):
        cols = st.columns([5, 1])
        with cols[0]:
            user_msg = st.text_input(
                "msg",
                placeholder="Type a message...",
                label_visibility="collapsed"
            )
        with cols[1]:
            send_btn = st.form_submit_button("➤")

        uploaded = st.file_uploader(
            "📎 Attach workout screenshot",
            type=["png", "jpg", "jpeg", "webp"],
            label_visibility="collapsed"
        )

        if send_btn:
            media_path = ""
            if uploaded:
                fname = f"upload_{int(time.time())}_{uploaded.name}"
                local = os.path.join(os.getcwd(), "generated", fname)
                with open(local, "wb") as f:
                    f.write(uploaded.getbuffer())
                media_path = local

            if user_msg or media_path:
                with st.spinner(""):
                    ok, out = run_cli("send", selected_phone, user_msg or "", media_path)
                    if ok:
                        st.rerun()
                    else:
                        st.error(out)


else:
    # ── No user selected landing ──
    st.html("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', sans-serif; }
    body { background: transparent; }
    .wa-phone {
        max-width: 420px; margin: 0 auto; border-radius: 28px; overflow: hidden;
        box-shadow: 0 20px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05);
        border: 2px solid #1a2733; background: #0b141a;
    }
    .wa-topbar {
        background: linear-gradient(135deg, #1f2c34, #1a2730);
        padding: 12px 16px; display: flex; align-items: center; gap: 12px;
        border-bottom: 1px solid #233040;
    }
    .wa-topbar-avatar {
        width: 40px; height: 40px; border-radius: 50%;
        background: linear-gradient(135deg, #00a884, #005c4b);
        display: flex; align-items: center; justify-content: center;
        font-size: 1.1rem; color: white; font-weight: 700;
    }
    .wa-topbar-info { flex: 1; }
    .wa-topbar-name { color: #e9edef; font-size: 1rem; font-weight: 600; }
    .wa-topbar-status { color: #8696a0; font-size: 0.75rem; }
    .wa-empty {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        height: 500px; gap: 16px; color: #8696a0;
    }
    .wa-empty-icon { font-size: 4rem; opacity: 0.3; }
    .wa-empty-text { font-size: 1rem; font-weight: 500; color: #aebac1; }
    .wa-empty-sub { font-size: 0.8rem; color: #667781; text-align: center; max-width: 280px; }
    </style>
    <div class="wa-phone">
        <div class="wa-topbar">
            <div class="wa-topbar-avatar">🏋️</div>
            <div class="wa-topbar-info">
                <div class="wa-topbar-name">ShowUp Coach</div>
                <div class="wa-topbar-status">WhatsApp Sandbox</div>
            </div>
        </div>
        <div class="wa-empty">
            <div class="wa-empty-icon">👈</div>
            <div class="wa-empty-text">Select a user from the sidebar</div>
            <div class="wa-empty-sub">Pick an existing user or create a new session to start chatting with the ShowUp fitness coach</div>
        </div>
    </div>
    """)

