import { useState } from "react";
import { signIn, signUp } from "../supabase.js";

const C = {
  bg:"#08080F",surface:"#0F0F1A",card:"#13131F",border:"#1E1E32",
  gold:"#F5C518",green:"#00D68F",red:"#FF4560",blue:"#4D9FFF",
  text:"#EEEEFF",muted:"#7070A0",mutedLight:"#9090B8",
};

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handle = async () => {
    setError(""); setLoading(true);
    try {
      if (mode === "signup") {
        const { error: e } = await signUp(email, password);
        if (e) throw e;
        setSuccess("Account created! Check your email to confirm, then sign in.");
        setMode("signin");
      } else {
        const { data, error: e } = await signIn(email, password);
        if (e) throw e;
        onAuth(data.user);
      }
    } catch(e) {
      setError(e.message || "Something went wrong. Try again.");
    }
    setLoading(false);
  };

  const inputStyle = {
    width:"100%", background:C.surface, border:`1px solid ${C.border}`,
    borderRadius:8, padding:"11px 14px", color:C.text, fontSize:14,
    fontFamily:"inherit", boxSizing:"border-box", marginBottom:12,
  };

  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:16,fontFamily:"'Inter',sans-serif"}}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:32,maxWidth:400,width:"100%"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:36,marginBottom:8}}>💳</div>
          <h2 style={{margin:"0 0 4px",color:C.gold,fontSize:20,fontWeight:900}}>Credit Changed My Life</h2>
          <p style={{color:C.muted,fontSize:13,margin:0}}>by POTENT</p>
        </div>

        <div style={{display:"flex",gap:8,marginBottom:20}}>
          {["signin","signup"].map(m=>(
            <button key={m} onClick={()=>setMode(m)} style={{flex:1,background:mode===m?C.gold:"transparent",color:mode===m?C.bg:C.muted,border:`1px solid ${mode===m?C.gold:C.border}`,borderRadius:8,padding:"9px 0",fontSize:13,fontWeight:mode===m?700:400,cursor:"pointer"}}>
              {m==="signin"?"Sign In":"Create Account"}
            </button>
          ))}
        </div>

        {mode==="signup" && <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name" style={inputStyle}/>}
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" style={inputStyle}/>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" style={inputStyle} onKeyDown={e=>e.key==="Enter"&&handle()}/>

        {error && <div style={{background:C.red+"14",border:`1px solid ${C.red}33`,borderRadius:8,padding:"10px 12px",fontSize:13,color:C.red,marginBottom:12}}>{error}</div>}
        {success && <div style={{background:C.green+"14",border:`1px solid ${C.green}33`,borderRadius:8,padding:"10px 12px",fontSize:13,color:C.green,marginBottom:12}}>{success}</div>}

        <button onClick={handle} disabled={loading||!email||!password} style={{width:"100%",background:C.gold,color:C.bg,border:"none",borderRadius:8,padding:"13px 0",fontSize:15,fontWeight:800,cursor:"pointer",opacity:loading||!email||!password?.5:1}}>
          {loading?"Loading...":(mode==="signin"?"Sign In":"Create Account")}
        </button>

        <p style={{color:C.muted,fontSize:12,textAlign:"center",marginTop:16}}>
          {mode==="signin"?"Don't have an account? ":"Already have an account? "}
          <button onClick={()=>setMode(mode==="signin"?"signup":"signin")} style={{background:"none",border:"none",color:C.gold,cursor:"pointer",fontSize:12,fontWeight:700,padding:0}}>
            {mode==="signin"?"Sign Up":"Sign In"}
          </button>
        </p>
      </div>
    </div>
  );
}
