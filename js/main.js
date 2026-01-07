/* Scroll reveal */
const observer=new IntersectionObserver(e=>{
  e.forEach(x=>{
    if(x.isIntersecting)x.target.classList.add("show")
  })
},{threshold:.15})
document.querySelectorAll(".reveal").forEach(el=>observer.observe(el))

/* Counters */
document.querySelectorAll("[data-num]").forEach(el=>{
  let t=+el.dataset.num,n=0
  let i=setInterval(()=>{
    n++
    el.textContent=n
    if(n>=t)clearInterval(i)
  },60)
})

/* ADVANCED CURSOR */
const cursor=document.getElementById("cursor")
const blur=document.getElementById("cursorBlur")

let cx=0,cy=0,bx=0,by=0

window.addEventListener("mousemove",e=>{
  cx=e.clientX
  cy=e.clientY
  cursor.style.left=cx+"px"
  cursor.style.top=cy+"px"
})

function animate(){
  bx+=(cx-bx)*0.08
  by+=(cy-by)*0.08
  blur.style.left=bx+"px"
  blur.style.top=by+"px"
  requestAnimationFrame(animate)
}
animate()
