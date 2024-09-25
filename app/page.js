'use client'
import { useState } from "react";
import styles from "./page.module.css";

let defaultBoard = [
  "72-------",
  "-5---9---",
  "----38---",
  "---4--5--",
  "--3---9--",
  "--1--3---",
  "---25----",
  "---6---3-",
  "-------19"
]

let solution = [
  "729146358",
  "358729146",
  "416538792",
  "897412563",
  "243865971",
  "561973824",
  "934251687",
  "182697435",
  "675384219"
]

function Cell ({value, inputID}){
  return(
    value=="-" ? 
    <input id={inputID} type="number" className={`${styles.cell} ${styles.input}`} /> 
    : <input id={inputID} readOnly type="number" className={styles.cell} value={value}/>
  )
}

function Board ({initialValues}) {
  let row = ["r1","r2","r3","r4","r5","r6","r7","r8","r9"]
  let col = ["c1","c2","c3","c4","c5","c6","c7","c8","c9"]

  return (
    <div className={styles.board}>
      {
        row.map((r,i) => (
            col.map((c, j) => (
                <Cell key={`${r}${c}`} inputID={`${r}${c}`} value={initialValues[i].charAt(j)} />
            ))
          )
        )
      }
    </div>
  )
}

export default function Home() {

  const [initialBoard, setInitialBoard] = useState(defaultBoard)

  function clickHandler() {
    setInitialBoard([
      "---------",
      "---------",
      "---------",
      "---------",
      "---------",
      "---------",
      "---------",
      "---------",
      "---------",
    ])
    console.log(initialBoard)
  }

  return (
      <main className={styles.main}>
        <Board initialValues={initialBoard}/>
        {/* <button className={styles.editButton} onClick={clickHandler}>edit</button> */}
      </main>
  );
}
