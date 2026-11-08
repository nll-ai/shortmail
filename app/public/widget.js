"use strict";(()=>{var se=[{id:"default",label:"Default",vars:{"--sm-accent":"#171717","--sm-accent-text":"#ffffff","--sm-bg":"#ffffff","--sm-surface":"#ffffff","--sm-text":"#171717","--sm-muted":"#525252","--sm-border":"#d4d4d4","--sm-radius":"0px","--sm-font":"var(--font-geist-sans, system-ui, sans-serif)"}},{id:"midnight",label:"Midnight",vars:{"--sm-accent":"#6366f1","--sm-accent-text":"#ffffff","--sm-bg":"#0b1020","--sm-surface":"#151c33","--sm-text":"#e5e7eb","--sm-muted":"#94a3b8","--sm-border":"#27324d","--sm-radius":"0.75rem","--sm-font":"var(--font-geist-sans, system-ui, sans-serif)"}},{id:"paper",label:"Paper",vars:{"--sm-accent":"#8a5a2b","--sm-accent-text":"#fffdf7","--sm-bg":"#faf6ef","--sm-surface":"#f3ecdf","--sm-text":"#3b2f24","--sm-muted":"#8a7a66","--sm-border":"#d9cbb4","--sm-radius":"0.25rem","--sm-font":"Georgia, 'Times New Roman', serif"}},{id:"contrast",label:"High contrast",vars:{"--sm-accent":"#ffe500","--sm-accent-text":"#000000","--sm-bg":"#000000","--sm-surface":"#111111","--sm-text":"#ffffff","--sm-muted":"#cccccc","--sm-border":"#ffffff","--sm-radius":"0rem","--sm-font":"var(--font-geist-mono, ui-monospace, monospace)"}}],ge="default";function ie(n){return se.find(i=>i.id===n)??se.find(i=>i.id===ge)}var G="shortmail-widget:change";var ye=`
  .sm-form { display: flex; flex-direction: column; gap: 1rem; text-align: left; color: var(--sm-text, #171717); }
  .sm-label { display: block; font-size: 0.875rem; }
  .sm-label-text { display: block; margin-bottom: 0.25rem; font-weight: 500; }
  .sm-fieldset { border: 0; padding: 0; margin: 0; font-size: 0.875rem; }
  .sm-radio-row { display: flex; gap: 1.5rem; }
  .sm-radio-label { display: flex; align-items: center; gap: 0.375rem; }
  .sm-input, .sm-select, .sm-textarea {
    width: 100%;
    border: 1px solid var(--sm-border, #d4d4d4);
    background: var(--sm-surface, #ffffff);
    color: var(--sm-text, #171717);
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    font-family: inherit;
    border-radius: var(--sm-radius, 0px);
  }
  .sm-input:focus, .sm-select:focus, .sm-textarea:focus {
    outline: none;
    border-color: var(--sm-accent, #171717);
  }
  .sm-button {
    width: 100%;
    background: var(--sm-accent, #171717);
    color: var(--sm-accent-text, #ffffff);
    border: none;
    padding: 0.625rem 1.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
  }
  .sm-button:hover:not(:disabled) { opacity: 0.8; }
  .sm-button:disabled { opacity: 0.4; cursor: not-allowed; }
  .sm-counter { display: block; margin-top: 0.25rem; text-align: right; font-size: 0.75rem; color: var(--sm-muted, #737373); }
  .sm-counter-over { color: #dc2626; font-weight: 700; }
  .sm-error { color: #dc2626; font-size: 0.875rem; }
  .sm-hint { font-size: 0.85rem; color: var(--sm-muted, #525252); }
  .sm-honeypot { position: absolute; left: -9999px; width: 0; height: 0; opacity: 0; }
`,M=null;function oe(){return M||(M=new CSSStyleSheet,M.replaceSync(ye)),M}function K(n){return n.trim().toLowerCase()}async function X(n){let i=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(n));return[...new Uint8Array(i)].map(e=>e.toString(16).padStart(2,"0")).join("")}function O(){let n=new Uint8Array(32);crypto.getRandomValues(n);let i="";for(let e of n)i+=String.fromCharCode(e);return btoa(i).replaceAll("+","-").replaceAll("/","_").replace(/=+$/g,"")}var $="shortmail.sender.v1",c={check:"Check your email, enter the code, and press Confirm email. Your letter stays on this page.",ready:"Email confirmed for this browser. Press Send shortmail when the letter is ready. Nothing is sent until you do.",expired:"That code expired. Request another.",mismatch:"That code does not match this form. Request a new code from this page.",invalid:"That code is not valid. Request another.",storage:"This browser will not keep the confirmation after you leave. You can still finish in this tab.",unconfirmed:"Confirm your email before the letter can be sent.",unavailable:"We could not send a code right now. Wait a few minutes and try again. Your letter stays on this page."};function ve(n,i){return n===null||i===null?n===i:n.challengeId===i.challengeId}function ae(n,i,e,t){let s=C(n);return!(t?.status==="issued"&&t.challengeId===e.challengeId)||!ve(s,i)?{stored:s,committed:!1}:(Q(n,e),{stored:e,committed:!0})}function le(n,i){return i?[...n,i]:[...n]}function re(){let n=new Map;return{getItem:i=>n.get(i)??null,setItem:(i,e)=>{n.set(i,e)},removeItem:i=>{n.delete(i)}}}function de(n){if(!n)return{store:re(),persistent:!1};try{return n.setItem($,n.getItem($)??""),{store:n,persistent:!0}}catch{return{store:re(),persistent:!1}}}function C(n){let i=n.getItem($);if(!i)return null;try{let e=JSON.parse(i);return!e.email||!e.challengeId||!e.challengeSecret||!e.sessionSecret||e.status!=="pending"&&e.status!=="confirmed"?null:{email:e.email,challengeId:e.challengeId,challengeSecret:e.challengeSecret,sessionSecret:e.sessionSecret,status:e.status,sessionExpiresAt:e.sessionExpiresAt??null}}catch{return null}}function Q(n,i){n.setItem($,JSON.stringify(i))}async function ce(n){let i={email:K(n),challengeId:O(),challengeSecret:O(),sessionSecret:O(),status:"pending",sessionExpiresAt:null};return{record:i,challengeSecretHash:await X(i.challengeSecret),sessionSecretHash:await X(i.sessionSecret)}}function D(n){let i=K(n.email),e=n.code.trim(),t=n.stored,s=t!==null&&t.email===i;return s&&t.status==="confirmed"&&t.sessionExpiresAt!==null&&t.sessionExpiresAt>n.now?{kind:"send",sessionSecret:t.sessionSecret}:s&&t.status==="pending"&&!e?{kind:"blocked",message:c.check}:e?!s||t.status==="confirmed"?{kind:"blocked",message:c.mismatch}:{kind:"confirm",token:e,challengeId:t.challengeId,challengeSecret:t.challengeSecret}:{kind:"start"}}var be="https://hallowed-leopard-387.convex.site",A=()=>be,J=500,Se=`
  :host {
    all: initial;
    display: block;
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    color-scheme: light;
    font-family: var(--sm-font, var(--font-geist-sans, system-ui, sans-serif));
    font-size: 16px;
    line-height: 1.5;
    color: var(--sm-text, #171717);
    -webkit-font-smoothing: antialiased;
  }
  :host([hidden]) { display: none; }
  :host *, :host *::before, :host *::after { box-sizing: border-box; }
  button, input, select, textarea { font-family: inherit; letter-spacing: inherit; }
  h1, h2, h3, h4, p { margin: 0; font: inherit; }
`,xe=`
  .sm-form { width: 100%; min-width: 0; }
  .sm-heading {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    letter-spacing: -0.025em;
    line-height: 1.3;
    color: var(--sm-text, #171717);
  }
  .sm-faqs { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
  .sm-faq {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.5;
    color: var(--sm-muted, #525252);
  }
  .sm-grid-2, .sm-label, .sm-fieldset {
    width: 100%;
    max-width: 100%;
    min-width: 0;
  }
  .sm-grid-2 { display: flex; flex-direction: column; gap: 1rem; }
  legend.sm-label-text { padding: 0; }
  .sm-input, .sm-textarea, select.sm-input {
    display: block;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    margin: 0;
    line-height: 1.4;
  }
  input.sm-input, select.sm-input { min-height: 2.5rem; }
  .sm-textarea { min-height: 6.5rem; resize: none; }
  .sm-input::placeholder, .sm-textarea::placeholder {
    color: var(--sm-muted, #525252);
    opacity: 1;
  }
  select.sm-input {
    appearance: none;
    -webkit-appearance: none;
    padding-right: 2.25rem;
    cursor: pointer;
    background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 6 L8 10.5 L12.5 6' fill='none' stroke='%23525252' stroke-width='1.25' stroke-linecap='square' stroke-linejoin='miter'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
    background-size: 0.9rem;
  }
  .sm-radio-label { font-weight: 400; cursor: pointer; }
  .sm-radio-label input {
    appearance: none;
    -webkit-appearance: none;
    width: 1rem;
    height: 1rem;
    margin: 0;
    border: 1px solid var(--sm-border, #d4d4d4);
    border-radius: 50%;
    background: var(--sm-surface, #ffffff);
    display: grid;
    place-content: center;
    flex: none;
  }
  .sm-radio-label input:checked { border-color: var(--sm-text, #171717); }
  .sm-radio-label input:checked::before {
    content: "";
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--sm-text, #171717);
  }
  .sm-radio-label input:focus-visible {
    outline: 2px solid var(--sm-accent, #171717);
    outline-offset: 2px;
  }
  .sm-button {
    display: block;
    width: 100%;
    max-width: 100%;
    min-height: 2.75rem;
    margin: 0;
    line-height: 1.25;
    border-radius: var(--sm-radius, 0);
  }
  .sm-hint { margin: 0; line-height: 1.5; }
  .sm-counter { font-variant-numeric: tabular-nums; }
  .sm-custom { margin-top: 0.5rem; }
`,we=`
  .sm-text-button {
    align-self: flex-start;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    color: var(--sm-text, #171717);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: underline;
    text-underline-offset: 0.15em;
    cursor: pointer;
  }
  .sm-text-button:focus-visible {
    outline: 2px solid var(--sm-accent, #171717);
    outline-offset: 2px;
  }
`;function me(n,i){if(Object.prototype.hasOwnProperty.call(n,i)){let e=n[i];delete n[i],Object.defineProperty(n,i,{value:e,configurable:!0,enumerable:!0})}}function Ee(){try{return window.localStorage}catch{return null}}function Ce(){return navigator.doNotTrack==="1"||window.doNotTrack==="1"}var Z=class extends HTMLElement{constructor(){super();this.vanity="";this.config=null;this.changeHandler=e=>this.applyWidgetChange(e.detail);this.verifyPoll=0;this.hostSheet=new CSSStyleSheet;this.polishSheet=new CSSStyleSheet;this.verifySheet=new CSSStyleSheet;this.shadow=this.attachShadow({mode:"open"}),this.hostSheet.replaceSync(Se),this.polishSheet.replaceSync(xe),this.verifySheet.replaceSync(we),this.applySheets(null)}static get observedAttributes(){return["vanity"]}applySheets(e){this.shadow.adoptedStyleSheets=le([this.hostSheet,oe(),this.polishSheet,this.verifySheet],e)}connectedCallback(){me(this,"vanity"),this.vanity||(this.vanity=this.getAttribute("vanity")??""),this.changeHandler=e=>this.applyWidgetChange(e.detail),window.addEventListener(G,this.changeHandler),this.load()}disconnectedCallback(){window.clearInterval(this.verifyPoll),window.removeEventListener(G,this.changeHandler)}applyWidgetChange(e){switch(e.kind){case"display-name":{this.config&&(this.config.displayName=e.value);let t=this.shadow.querySelector(".sm-heading");t&&(t.textContent=`Send a shortmail to ${e.value}`);break}case"heading-added":{this.config&&!this.config.headings.includes(e.heading)&&this.config.headings.push(e.heading);let t=this.shadow.querySelector("select");if(t){let s=document.createElement("option");s.value=e.heading,s.textContent=e.heading,t.appendChild(s)}break}case"heading-removed":{this.config&&(this.config.headings=this.config.headings.filter(l=>l!==e.heading));let t=this.shadow.querySelector("select"),s=[...t?.options??[]].find(l=>l.value===e.heading),o=s?.selected??!1;s?.remove(),o&&t&&(t.value="",t.dispatchEvent(new Event("change",{bubbles:!0})));break}case"faq-added":{this.config&&this.config.faqs.push({question:e.question,answer:e.answer}),this.appendFaqQuestion(e.question);break}case"faq-edited":{let t=e.previousQuestion??e.question;if(this.config){let o=this.config.faqs.find(l=>l.question===t);o&&(o.question=e.question,o.answer=e.answer)}let s=this.faqNodes().find(o=>o.textContent===t);s&&(s.textContent=e.question);break}case"faq-removed":{this.config&&(this.config.faqs=this.config.faqs.filter(s=>s.question!==e.question)),this.faqNodes().find(s=>s.textContent===e.question)?.remove();let t=this.shadow.querySelector(".sm-faqs");t&&t.childElementCount===0&&t.remove();break}case"theme":{this.config&&(this.config.theme={preset:e.preset,customCss:e.customCss}),this.applyTheme();break}case"vanity":{this.setAttribute("vanity",e.vanity);break}}}attributeChangedCallback(){let e=this.getAttribute("vanity")??"";e&&e!==this.vanity&&(this.vanity=e,this.isConnected&&this.load())}mount(e,t){this.setAttribute("vanity",t.vanity),e.appendChild(this)}async load(){if(!this.vanity){this.renderMessage("shortmail-widget: no vanity configured",!0);return}this.renderMessage("Loading\u2026");try{let e=await fetch(`${A()}/api/embed/${encodeURIComponent(this.vanity)}/config`);if(e.status===403){this.renderMessage("This form is not allowed to be embedded on this site.");return}if(!e.ok){this.renderMessage("This shortmail page could not be found.");return}this.config=await e.json(),this.applyTheme(),this.renderForm(),this.beaconView()}catch{this.renderMessage("Could not load the form \u2014 network error.")}}applyTheme(){if(!this.config)return;let e=ie(this.config.theme?.preset??null);for(let[s,o]of Object.entries(e.vars))this.style.setProperty(s,o);let t=null;if(this.config.theme?.customCss)try{t=new CSSStyleSheet,t.replaceSync(this.config.theme.customCss)}catch{t=null}this.applySheets(t)}beaconView(){if(!(Ce()||!this.config))try{let e=JSON.stringify({event:"form_view",path:`/send/${this.config.vanityName}`,ref:document.referrer||void 0}),t=`${A()}/api/collect/${encodeURIComponent(this.config.vanityName)}`;typeof navigator.sendBeacon=="function"&&navigator.sendBeacon(t,e)||fetch(t,{method:"POST",keepalive:!0,headers:{"Content-Type":"text/plain"},body:e}).catch(()=>{})}catch{}}renderMessage(e,t=!1){this.shadow.innerHTML="";let s=document.createElement("p");s.textContent=e,t&&(s.className="sm-error"),this.shadow.appendChild(s)}renderForm(){if(!this.config)return;let e=this.config;this.shadow.innerHTML="";let t=document.createElement("form");t.setAttribute("part","form"),t.className="sm-form";let s=document.createElement("h3");s.className="sm-heading",s.setAttribute("part","heading"),s.textContent=`Send a shortmail to ${e.displayName}`,t.appendChild(s);for(let r of e.faqs)this.appendFaqQuestion(r.question,t);let o=this.textField("Your name","name"),l=this.textField("Your email","email");l.input.type="email",l.input.required=!0,o.input.required=!0;let q=document.createElement("div");q.className="sm-grid-2",q.appendChild(o.label),q.appendChild(l.label),t.appendChild(q);let V=document.createElement("fieldset");V.className="sm-fieldset";let j=document.createElement("legend");j.className="sm-label-text",j.textContent="Do you need a reply?";let F=document.createElement("div");F.className="sm-radio-row";let ee="no";for(let[r,a]of[["no","No"],["yes","Yes"]]){let u=document.createElement("label"),d=document.createElement("input");d.type="radio",d.name="reply_needed",d.value=r,d.checked=r==="no",d.addEventListener("change",()=>{d.checked&&(ee=r)}),u.className="sm-radio-label",u.appendChild(d),u.append(a),F.appendChild(u)}V.append(j,F),t.appendChild(V);let I=document.createElement("label");I.className="sm-label";let W=document.createElement("span");W.className="sm-label-text",W.textContent="Subject",I.appendChild(W);let p=document.createElement("select");p.className="sm-input",p.setAttribute("part","input"),p.required=!0;let Y=document.createElement("option");Y.value="",Y.textContent="Pick a subject\u2026",p.appendChild(Y);for(let r of e.headings){let a=document.createElement("option");a.value=r,a.textContent=r,p.appendChild(a)}let z=document.createElement("option");z.value="OTHER",z.textContent="Other\u2026",p.appendChild(z),I.appendChild(p);let N=document.createElement("div");N.className="sm-custom",N.style.display="none";let k=document.createElement("input");k.className="sm-input",k.placeholder="Your own subject",N.appendChild(k),p.addEventListener("change",()=>{N.style.display=p.value==="OTHER"?"block":"none"}),I.appendChild(N),t.appendChild(I);let P=document.createElement("label");P.className="sm-label";let U=document.createElement("span");U.className="sm-label-text",U.textContent="Message",P.appendChild(U);let f=document.createElement("textarea");f.className="sm-textarea",f.setAttribute("part","input"),f.required=!0,f.maxLength=J+1;let R=document.createElement("div");R.className="sm-counter",R.textContent=`0/${J}`,f.addEventListener("input",()=>{R.textContent=`${f.value.length}/${J}`,_()}),P.appendChild(f),P.appendChild(R),t.appendChild(P);let v=document.createElement("input");v.type="text",v.name="website",v.tabIndex=-1,v.autocomplete="off",v.className="sm-honeypot",t.appendChild(v);let w=document.createElement("p");w.className="sm-hint",w.style.display="none";let E=document.createElement("label");E.className="sm-label",E.style.display="none";let B=document.createElement("span");B.className="sm-label-text",B.textContent="Confirmation code";let b=document.createElement("input");b.className="sm-input",b.autocomplete="one-time-code",b.placeholder="Paste the code from your email",E.append(B,b);let g=document.createElement("button");g.type="button",g.className="sm-text-button",g.textContent="Email me a confirmation code";let h=document.createElement("button");h.type="button",h.className="sm-button",h.textContent="Confirm email",h.style.display="none",t.appendChild(w),t.appendChild(E),t.appendChild(g),t.appendChild(h);let S=document.createElement("p");S.className="sm-error",S.style.display="none",t.appendChild(S);let m=document.createElement("button");m.type="submit",m.className="sm-button",m.setAttribute("part","button"),m.setAttribute("part","button"),m.textContent="Send shortmail",m.disabled=!0,t.appendChild(m);let ue=()=>o.input.value.trim().length>0&&l.input.validity.valid&&f.value.trim().length>0&&(p.value==="OTHER"?k.value.trim().length>0:p.value!=="");function _(){m.disabled=!ue()}for(let r of[o.input,l.input,k])r.addEventListener("input",_);p.addEventListener("change",_),_();let y=de(Ee());y.persistent||(w.textContent=c.storage);let x=r=>{w.textContent=r,w.style.display=r?"block":"none"},H=()=>{let r=D({email:l.input.value,code:"",stored:C(y.store),now:Date.now()}),a=C(y.store),u=r.kind==="send",d=a?.email===l.input.value.trim().toLowerCase()&&a.status==="pending";u?(E.style.display="none",g.style.display="none",h.style.display="none",m.style.display="block",x(c.ready)):(d||(E.style.display="none",h.style.display="none",m.style.display="block"),g.style.display="block",w.textContent===c.ready&&x(y.persistent?"":c.storage))};l.input.addEventListener("input",H),H();let L=null,te=()=>L||(L=pe().finally(()=>{L=null}),L),pe=async()=>{let r=C(y.store),a=await ce(l.input.value),u=null;try{let ne=await fetch(`${A()}/api/verify/start`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:a.record.email,challengeId:a.record.challengeId,challengeSecretHash:a.challengeSecretHash,sessionSecretHash:a.sessionSecretHash})});ne.ok&&(u=await ne.json())}catch{u=null}let d=ae(y.store,r,a.record,u);if(!d.committed||!d.stored){x(u===null?"Network error \u2014 please try again.":c.unavailable),H();return}let T=d.stored;E.style.display="block",g.style.display="block",g.textContent="Send another code",h.style.display="block",m.style.display="none",x(c.check),window.clearInterval(this.verifyPoll),this.verifyPoll=window.setInterval(()=>{he(T)},5e3)},he=async r=>{(await(await fetch(`${A()}/api/verify/poll`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({challengeId:r.challengeId,challengeSecret:r.challengeSecret})})).json().catch(()=>({}))).status==="expired"&&(window.clearInterval(this.verifyPoll),x(c.expired))};b.addEventListener("keydown",r=>{r.key==="Enter"&&(r.preventDefault(),h.click())}),g.addEventListener("click",()=>{te()}),h.addEventListener("click",()=>{fe()});let fe=async()=>{let r=C(y.store),a=D({email:l.input.value,code:b.value,stored:r,now:Date.now()});if(a.kind!=="confirm"){x(a.kind==="blocked"?a.message:c.unconfirmed);return}let d=await(await fetch(`${A()}/api/verify/confirm`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:a.token,challengeId:a.challengeId,challengeSecret:a.challengeSecret})})).json().catch(()=>({}));if(d.status==="confirmed"&&r){window.clearInterval(this.verifyPoll),Q(y.store,{...r,status:"confirmed",sessionExpiresAt:d.sessionExpiresAt??null}),b.value="",H();return}x(d.status==="expired"?c.expired:d.status==="mismatch"?c.mismatch:c.invalid)};t.addEventListener("submit",async r=>{if(r.preventDefault(),m.disabled||v.value!=="")return;S.style.display="none";let a=D({email:l.input.value,code:b.value,stored:C(y.store),now:Date.now()});if(a.kind!=="send"){a.kind==="start"?await te():x(a.kind==="blocked"?a.message:c.check);return}let u=new URLSearchParams({sender_name:o.input.value,sender_email:l.input.value,reply_needed:ee,subject:p.value,custom_subject:k.value,message:f.value,website:v.value,session_secret:a.sessionSecret});m.disabled=!0;try{let d=await fetch(`${A()}/api/send/${encodeURIComponent(e.vanityName)}`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:u.toString()});if(d.ok){window.clearInterval(this.verifyPoll),t.replaceWith(this.successNote());return}let T=await d.json().catch(()=>({}));S.textContent=T.error==="daily_cap_exceeded"?"This person is receiving too many messages today \u2014 please try again tomorrow.":T.error==="disposable_email"?"Please use a non-disposable email address.":T.error==="email_unverified"?c.unconfirmed:T.error==="sender_rate_limited"?"You have sent several letters from this address today. Try again tomorrow.":"Something went wrong \u2014 please try again.",S.style.display="block",m.disabled=!1}catch{S.textContent="Network error \u2014 please try again.",S.style.display="block",m.disabled=!1}}),this.shadow.appendChild(t)}faqNodes(){return[...this.shadow.querySelectorAll(".sm-faq")]}ensureFaqList(e){let t=e??this.shadow.querySelector(".sm-form");if(!t)return null;let s=t.querySelector(".sm-faqs");if(s)return s;let o=document.createElement("div");o.className="sm-faqs";let l=t.querySelector(".sm-heading");return l?.nextSibling?t.insertBefore(o,l.nextSibling):t.appendChild(o),o}appendFaqQuestion(e,t){let s=this.ensureFaqList(t);if(!s)return;let o=document.createElement("p");o.className="sm-faq",o.setAttribute("part","faq"),o.textContent=e,s.appendChild(o)}textField(e,t){let s=document.createElement("label");s.className="sm-label";let o=document.createElement("span");o.className="sm-label-text",o.textContent=e;let l=document.createElement("input");return l.className="sm-input",l.setAttribute("part",`input ${t}`),s.appendChild(o),s.appendChild(l),{label:s,input:l}}successNote(){let e=document.createElement("div");e.className="success";let t=this.config?.displayName??"them";return e.textContent=`Message sent to ${t}! It lands in their inbox as a plain, short email.`,e}};customElements.get("shortmail-widget")||customElements.define("shortmail-widget",Z);var ke=window;ke.ShortmailWidget={mount:(n,i)=>{let e=document.createElement("shortmail-widget");return e.setAttribute("vanity",i.vanity),me(e,"vanity"),n.appendChild(e),e}};})();
