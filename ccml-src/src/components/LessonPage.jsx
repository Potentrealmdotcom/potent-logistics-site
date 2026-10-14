import { useState } from "react";
const C = {
  bg:"#08080F",surface:"#0F0F1A",card:"#13131F",border:"#1E1E32",borderLight:"#2A2A42",
  gold:"#F5C518",green:"#00D68F",red:"#FF4560",blue:"#4D9FFF",purple:"#9B6BFF",orange:"#FF8C42",
  text:"#EEEEFF",muted:"#7070A0",mutedLight:"#9090B8",
};
const FONT="'Inter',-apple-system,sans-serif";

const CALLOUT_STYLES = {
  gold:  { bg:C.gold+"14",   border:C.gold+"44",   color:C.gold   },
  green: { bg:C.green+"14",  border:C.green+"44",  color:C.green  },
  blue:  { bg:C.blue+"14",   border:C.blue+"44",   color:C.blue   },
  purple:{ bg:C.purple+"14", border:C.purple+"44", color:C.purple },
  red:   { bg:C.red+"14",    border:C.red+"44",    color:C.red    },
};

export default function LessonPage({ lesson, onComplete, isCompleted, onBack }) {
  const [done, setDone] = useState(isCompleted);

  const handleComplete = () => {
    setDone(true);
    onComplete && onComplete(lesson.id);
  };

  const renderSection = (section, i) => {
    switch(section.type) {
      case "intro":
        return (
          <div key={i} style={{display:"flex",gap:14,alignItems:"flex-start",background:C.surface,border:`1px solid ${C.borderLight}`,borderRadius:12,padding:18,marginBottom:16}}>
            <span style={{fontSize:32,flexShrink:0}}>{section.icon}</span>
            <p style={{color:C.text,fontSize:15,lineHeight:1.75,margin:0}}>{section.content}</p>
          </div>
        );
      case "keypoints":
        return (
          <div key={i} style={{background:C.gold+"0F",border:`1px solid ${C.gold}33`,borderRadius:12,padding:18,marginBottom:16}}>
            <div style={{fontWeight:800,fontSize:13,color:C.gold,marginBottom:12,textTransform:"uppercase",letterSpacing:1}}>{section.title}</div>
            {section.points.map((p,j)=>(
              <div key={j} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:8}}>
                <span style={{color:C.gold,fontWeight:900,fontSize:14,flexShrink:0,marginTop:1}}>✦</span>
                <span style={{color:C.text,fontSize:14,lineHeight:1.6}}>{p}</span>
              </div>
            ))}
          </div>
        );
      case "content":
        return (
          <div key={i} style={{marginBottom:20}}>
            {section.title && <h3 style={{fontWeight:800,fontSize:16,color:C.text,marginBottom:10,paddingBottom:8,borderBottom:`1px solid ${C.border}`}}>{section.title}</h3>}
            <div style={{color:C.mutedLight,fontSize:14,lineHeight:1.8,whiteSpace:"pre-line"}}>{section.content}</div>
          </div>
        );
      case "callout":
        const cs = CALLOUT_STYLES[section.variant] || CALLOUT_STYLES.gold;
        return (
          <div key={i} style={{background:cs.bg,border:`1px solid ${cs.border}`,borderRadius:12,padding:16,marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <span style={{fontSize:20}}>{section.icon}</span>
              <span style={{fontWeight:800,fontSize:13,color:cs.color}}>{section.title}</span>
            </div>
            <div style={{color:C.text,fontSize:14,lineHeight:1.7,whiteSpace:"pre-line"}}>{section.content}</div>
          </div>
        );
      case "warning":
        return (
          <div key={i} style={{background:C.red+"0F",border:`1px solid ${C.red}33`,borderRadius:12,padding:16,marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <span style={{fontSize:18}}>{section.icon}</span>
              <span style={{fontWeight:800,fontSize:13,color:C.red}}>{section.title}</span>
            </div>
            <div style={{color:C.text,fontSize:14,lineHeight:1.7,whiteSpace:"pre-line"}}>{section.content}</div>
          </div>
        );
      case "action":
        return (
          <div key={i} style={{background:C.green+"0F",border:`1px solid ${C.green}33`,borderRadius:12,padding:18,marginBottom:16}}>
            <div style={{fontWeight:800,fontSize:13,color:C.green,marginBottom:12,textTransform:"uppercase",letterSpacing:1}}>✅ {section.title}</div>
            {section.steps.map((s,j)=>(
              <div key={j} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:8}}>
                <span style={{background:C.green,color:C.bg,borderRadius:"50%",width:20,height:20,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,flexShrink:0,marginTop:2}}>{j+1}</span>
                <span style={{color:C.text,fontSize:14,lineHeight:1.6}}>{s}</span>
              </div>
            ))}
          </div>
        );
      case "table":
        return (
          <div key={i} style={{marginBottom:20,overflowX:"auto"}}>
            {section.title && <h3 style={{fontWeight:800,fontSize:15,color:C.text,marginBottom:10}}>{section.title}</h3>}
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr>{section.headers.map((h,j)=>(
                  <th key={j} style={{background:C.surface,color:C.gold,fontWeight:700,padding:"10px 12px",textAlign:"left",borderBottom:`2px solid ${C.gold}44`,whiteSpace:"nowrap"}}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {section.rows.map((row,j)=>(
                  <tr key={j} style={{background:j%2===0?C.card:"transparent"}}>
                    {row.map((cell,k)=>(
                      <td key={k} style={{padding:"9px 12px",color:k===0?C.text:C.mutedLight,borderBottom:`1px solid ${C.border}`,fontSize:12}}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div style={{padding:16,fontFamily:FONT,maxWidth:720,margin:"0 auto"}}>
      <button onClick={onBack} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,padding:"6px 12px",color:C.muted,fontSize:12,cursor:"pointer",marginBottom:16}}>← Back to Course</button>

      {/* Lesson Header */}
      <div style={{background:`linear-gradient(135deg,${C.gold}14,${C.purple}0A)`,border:`1px solid ${C.gold}33`,borderRadius:14,padding:20,marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
          <span style={{background:C.gold+"22",border:`1px solid ${C.gold}44`,borderRadius:6,padding:"3px 10px",fontSize:11,fontWeight:700,color:C.gold,textTransform:"uppercase",letterSpacing:1}}>Lesson</span>
          <span style={{color:C.muted,fontSize:12}}>{lesson.duration}</span>
          {done && <span style={{background:C.green+"22",color:C.green,border:`1px solid ${C.green}44`,borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:700}}>✓ COMPLETE</span>}
        </div>
        <h1 style={{fontSize:"clamp(18px,4vw,26px)",fontWeight:900,color:C.text,margin:"0 0 4px",lineHeight:1.2}}>{lesson.title}</h1>
      </div>

      {/* Lesson Content */}
      {lesson.sections.map((section, i) => renderSection(section, i))}

      {/* Complete Button */}
      {!done ? (
        <button onClick={handleComplete} style={{width:"100%",background:C.gold,color:C.bg,border:"none",borderRadius:10,padding:"15px 0",fontSize:15,fontWeight:800,cursor:"pointer",marginTop:8}}>
          ✓ Mark Lesson Complete
        </button>
      ) : (
        <div style={{width:"100%",background:C.green+"22",border:`1px solid ${C.green}44`,borderRadius:10,padding:"15px 0",fontSize:15,fontWeight:700,color:C.green,textAlign:"center",marginTop:8}}>
          ✓ Lesson Complete — Keep Going!
        </div>
      )}
    </div>
  );
}
