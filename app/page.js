import styles from "./page.module.css";

let row = ["r1","r2","r3","r4","r5","r6","r7","r8","r9"]
let col = ["c1","c2","c3","c4","c5","c6","c7","c8","c9"]
let initialBoard = [
  "72-------",
  "-5---9---",
  "----38---",
  "---4--5--",
  "--3---9--",
  "--1--3---",
  "---25----",
  "---6---3-",
  "-------19",
]

function Cell ({value}){
  return(
    value=="-" ? 
    <input type="text" className={`${styles.cell} ${styles.input}`} /> 
    : <input readOnly type="text" className={styles.cell} value={value}/>
  )
}

function Board () {
  return (
    <div className={styles.board}>
      {
        row.map((r,i) => {
          return(
            col.map((c, j)=>(
                <Cell key={`${r}${c}`} value={initialBoard[i].charAt(j)} />
            ))
          )
        })
      }
    </div>
  )
}

export default function Home() {
  return (
      <main className={styles.main}>
        <Board />
      </main>
  );
}
