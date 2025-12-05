import React, { useState } from "react";
import "../styles/auth.css";

const API_URL = "http://localhost:5000/api";

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [message, setMessage] = useState({ text: "", type: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: "", type: "" });

    const url = isLogin ? `${API_URL}/login` : `${API_URL}/register`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    const data = await response.json();

    if (response.ok) {
      if (isLogin) {
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("user", JSON.stringify(data.user));
        window.location.href = "/dashboard";
      } else {
        setMessage({ text: "Registration successful!", type: "success" });
      }
    } else {
      setMessage({ text: data.message, type: "error" });
    }

    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Habit Tracker</h1>

        {message.text && (
          <div className={`alert ${message.type}`}>{message.text}</div>
        )}

        <form onSubmit={handleSubmit}>
          <label>Username</label>
          <input name="username" onChange={(e) => setFormData({
            ...formData, username: e.target.value
          })} required />

          {!isLogin && (
            <>
              <label>Email</label>
              <input name="email" type="email" required
                onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </>
          )}

          <label>Password</label>
          <input type="password" name="password"
            onChange={(e) => setFormData({ ...formData, password: e.target.value })} required />

          {!isLogin && (
            <>
              <label>Confirm Password</label>
              <input type="password"
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} />
            </>
          )}

          <button type="submit" disabled={loading}>
            {loading ? "Please wait..." : isLogin ? "Login" : "Register"}
          </button>
        </form>

        <p>
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <button className="switch-btn" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "Sign Up" : "Login"}
          </button>
        </p>
      </div>
    </div>
  );
}
