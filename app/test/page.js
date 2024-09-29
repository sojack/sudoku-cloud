'use client'
import { useState } from "react";

function Cell ({value, ehandler}){
    return(
        <div>
            <p onClick={ehandler}>Value is set to: {value}</p>
            <input onChange={ehandler} type="number" value={value}/>

        </div>
    )
}

export default function Test() {

    let [value, setValue]= useState(1)

    function handler (){
        setValue(value += 1)
    }

    return (
    <div>
        test
        <div>
            <Cell value={value} ehandler={handler} ></Cell>
            <button onClick={handler} >click</button>
        </div>
    </div>
    );
}
