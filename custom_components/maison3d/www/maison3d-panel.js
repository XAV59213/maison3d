class Maison3DPanel extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const root=this.attachShadow({mode:"open"});
    const style=document.createElement("style");
    style.textContent=":host{display:block;height:100%}iframe{width:100%;height:calc(100vh - 56px);min-height:500px;border:0;background:#101923}";
    const frame=document.createElement("iframe");
    frame.src="/maison3d-assets/index.html";
    frame.title="Maison 3D V2.0";
    frame.allow="fullscreen";
    root.append(style,frame);
  }
}
if(!customElements.get("maison3d-panel"))customElements.define("maison3d-panel",Maison3DPanel);
