/*===================================================================================================================\\
|                                                 Settings
\\===================================================================================================================*/

const version = 'v0.3.9'

let options = {
    sort: {
        label: 'Sorting Options:',
        subops: {
            show: { label: 'Show Value', value: false, },
            order: { label: 'Order', value: 'Popularity', type: ['Popularity', 'Alphabetical', 'Remaining Words', 'Score'], },     
            score: { 
                label: '',
                require: ['sort.order',['Remaining Words','Score']],
                subops: {
                    criteria: {
                        label: 'Criteria', 
                        value: 'Average',
                        type: ['Average', 'Worst Case'],
                        require: ['sort.order', ['Remaining Words','Score']],
                    },
                    match: {
                        label: 'Req Match', 
                        value: 'Full', 
                        type: ['Full', 'Partial', 'None'], 
                        require: ['sort.order', ['Remaining Words','Score']],
                    },
                    list: {     
                        label: 'Alt List',
                        value: '', 
                        type: [''],
                        require: ['sort.order', ['Remaining Words','Score']],
                    },
                },
            },
        },
    },
    lists: {
        label: 'Filter Word Lists:',
    },
}

const wordlistUrl = 'wordlist.json'
const helptextUrl = 'help.txt'

let ready = false 


/*===================================================================================================================\\
|                                                  Parse Functions
\\===================================================================================================================*/

// main parser
function parse(str) {
    let ANS = []
    let val = null
    let num = null
    let inv = false
    let i_str = 0
    let n_str = str.length
    let depth = 0
    let mode = null
    while (i_str < n_str) {
        // get character
        let cha = str[i_str] 
        // handle strings
        if ('"\''.includes(mode)) {
            if (cha === mode) { mode = 'done' }
            else { val += cha }
        } else {
            // for non-string search, enforce lowercase and ignore spaces
            if (' ,'.includes(cha)) { i_str += 1; continue }
            cha = cha.toLowerCase()
            // handle groups
            if ('(['.includes(mode)) {
                if (cha === mode ) { depth -= 1 }
                if ((mode==='[' && cha===']')||(mode==='(' && cha===')')) { depth += 1 }
                if (depth !== 0) { val += cha }
                else { 
                    val = parse(val)
                    mode = 'done' 
                }                
            } else {
                // starting strings and groups
                if ('"\'[('.includes(cha)) {
                    val = ''
                    mode = cha        
                    if ('(['.includes(cha)){ depth = -1 }
                // handle numbers
                } else if ('1234567890-+'.includes(cha)) {
                    mode = 'num'
                    if ('1234567890'.includes(cha)) {
                        if (num === null) { num = cha }
                        else if (typeof num === 'string') { num += cha }
                        else if (Array.isArray(num)) { num[num.length-1] = num[num.length-1] + cha }
                    } else if ('-+'.includes(cha)) { 
                        num = [num,'']
                    }
                // handle inverse
                } else if ('!~^'.includes(cha)) {
                    inv = !inv
                // handle other chcarters
                } else {
                    mode = 'done'
                    if (!'#*_?.'.includes(cha)) { val = cha }        
                }
            }
        }
        // handle saving new value
        if (mode == 'done') {
            if (Array.isArray(num)) { num = num.map(i => parseInt(i)) }
            else if (num !== null) { num = parseInt(num) }
            // handle cleaning non-special strings
            if (typeof val==='string' && val.length>1) {
                if (RegExp('^[A-Za-z ,]*$').test(val)) {
                    val = val.toLowerCase()
                    val = val.replace(' ','').replace(',','')
                }
            }
            ANS.push([val,num,inv])
            mode = null
            val = null
            num = null
            inv = false
        }
        i_str += 1
    }
    // handle partial completion for numbers
    if (num != null) {
        if (Array.isArray(num)) { num = num.map(i => parseInt(i)) }
        else if (num !== null) { num = parseInt(num) }
        ANS.push([null,num,inv])
    }
    return ANS
}

function cleannums(nums) {
    let ans = []
    for (let num of nums) {
        if (!Array.isArray(num)) { 
            if (num===null) { num = 1 }
            num = [num,num]
        }
        num = num.map(n => (isNaN(n) || n===null)? Infinity : n)
        ans.push(num)
    }
    return ans
}

function cleannum(num) {
    if (Array.isArray(num)) {
        num = num.map(n => (isNaN(n) || n===null)? Infinity : n)
        if (num[0]===num[1]) { num = num[0] }
    }
    if (num===1) { num = null }
    return num
}

function mulnums(nums) {
    let ans = cleannums(nums)
    ans = ans.reduce((a,b)=>[a[0]*b[0],a[1]*b[1]])
    return cleannum(ans)
}

function rangenums(nums) {
    let ans = cleannums(nums)
    ans = ans.reduce((a,b)=>[Math.min(a[0],b[0]),Math.max(a[1],b[1])])
    return cleannum(ans)
}

function countval(val,num,inv) {
    if (Array.isArray(val)) {
        val = val.map(v=>countval(...v))
        return mulnums([rangenums(val),num])
    } else {
        return mulnums([val.length,num])
    }
}

function num2regex(num) {
    let r = ''
    if (num !== null) {
        if (Array.isArray(num)) {
            if (num[1]===Infinity) { r += '{'+String(num[0])+',}' }
            else { r += '{'+String(num[0])+','+String(num[1])+'}' }                    
        } else { r += '{'+String(num)+'}' }
    }
    return r
}

// function re_cloth(val) {
//     if (val.length!==1 && !'])'.includes(val.charAt(val.length-1))) {
//         val = `(?:${val})`
//     } 
//     return val
// }

// function re_inv(val, inv=true) {
//     if (inv) {
//         if (val==='.') {
//             val = '[]'
//         } else if (val.length===1) {
//             val = `[^${val}]`
//         } else {
//             if (val.charAt(val.length-1)===']') { val = '[^' + val.slice(2) }
//             else { val = re_num(`(?!${val}).`,cleannum(val.length)) }
//         }
//     }
//     return val
// }

// function re_num(val, num=null) {
//     if (num!==null) { val = re_cloth(val) } 
//     return val + num2regex(num)
// }

// function re_or(vals) {
//     if (vals.some(val => val.length>1)) { return re_cloth(vals.join('|')) }
//     else { return `[${vals.join('')}]` }
// }

// function re_and(vals) {
//     vals = vals.map(val => (val.length>0)? `(?=${val})` : '')
//     return vals.join('')
// }

// function re_count(val, num) {
//     const [min, max] = num
//     if (max===0 && val.length<=1) {
//         val = `^[^${val}]*$`
//     } else if (max===Infinity) {
//         if (min===0) { val = ''}
//         else { val = `.*(?:${val}.*){${min}}` }
//     } else {
//         const inv = cloth(re_inv(val))
//         val = `^${inv}*(?:${val}${inv}*)${num2regex(num)}$`        
//     }
//     return val
// }

function val2regex(val, num, inv, loose) {
    let r = ''
    num = cleannum(num)
    if (Array.isArray(val)) {
        if (val.length===1) {
            const [v,n,i] = val[0]
            return val2regex(v,mulnums([num,n]),inv^i)
        } else {
            if (val.every(([v,n,i]) => {
                if (!Array.isArray(v) && v.length===1 && !i) {
                    if (cleannum(n)===null) { return true }
                }
                return false
            })) {
                r += '['
                if (inv) { r += '^' }
                r += val.map(([v,n,i])=>v).join('') + ']'
            } else {
                if (inv) { 
                    let L = countval(val,1,inv)
                    val = val.map(([v,n,i])=> val2regex(v,n,i,loose))
                    val = '(?:(?!' + val.join('|') + ').)'
                    val += num2regex(L)
                    if (L!==null && num!==null) { val = '(?:' + val + ')' }
                    r += val
                } else {
                    val = val.map(([v,n,i])=> val2regex(v,n,i,loose) )
                    r += '(?:' + val.join('|') + ')'
                }
            }
        }
    } else {
        if (val === null) { val = '.' }
        if (inv) {
            if (val.length==1) {
                if (loose) { r += '.' }
                else { r += '[^' + val + ']' }
            } else {
                const L = val.length
                if (loose) { val = '.' }
                else { val = '(?:(?!'+val+').)' }
                if (L!==1) { val += '{'+L+'}' }
                if (num !== null) { val = '(?:'+val+')' }
                r += val
            }
        } else {
            if (num === null || val.length==1) { r += val }
            else { r += '(?:'+val+')' }
        }        
    }
    return r + num2regex(num)
}

function pattern2regex(pattern, limits, loose=false) {
    let r = ''
    for (const [num, val, inv] of pattern) { r += val2regex(num, val, inv, loose) }
    r = `(?=^${r}$)`
    for (const L in limits) {
        let [min, max] = limits[L]
        if (isNaN(max) || max===null) { max = Infinity }
        if (max===0 && L.length<=1) {
            r += `(?=^[^${L}]*$)`
        } else if (max===Infinity) {
            if (min!==0) { r += '(?=.*(?:'+L+'.*){'+String(min)+'})' }
        } else {
            min = String(min)
            max = String(max)
            if (L.length <= 1) { r += `(?=^[^${L}]*(?:${L}[^${L}]*){${min},${max}}$)` }
            else { r += `(?=^(?:(?!${L}).)*(?:${L}(?:(?!${L}).)*){${min},${max}}$)` }
        }
    }
    console.log(r)
    return new RegExp(r)
}

function guess2regex(guess, sol) {
    let r = ''
    let c = new Set()
    const n = guess.length
    for (let i=0; i<n; i++) {
        const L = guess[i]
        if (L === sol[i]) { r += L }
        else { r += `[^${L}]`; c.add(L) }
    }
    r = `(?=^${r}$)`
    for (const L of c) {
        const c_guess = countStr(guess,L) 
        const c_sol = countStr(sol,L)
        if (c_guess > c_sol) { r += `(?=^[^${L}]*(?:${L}[^${L}]*){${c_sol}}$)` }
        else { r += `(?=^[^${L}]*(?:${L}[^${L}]*){${c_guess},}$)` }
    }
    return new RegExp(r)
}

function guess2looseregex(guess, sol) {
    let r = ''
    let c = new Set()
    const n = guess.length
    for (let i=0; i<n; i++) {
        const L = guess[i]
        if (L === sol[i]) { r += L }
        else { r += '.'; c.add(L) }
    }
    r = `(?=^${r}$)`
    for (const L of c) {
        const c_guess = countStr(guess,L)
        const c_sol = countStr(sol,L)
        if (c_sol > 0) { r += `(?=^[^${L}]*(?:${L}[^${L}]*){${Math.min(c_guess,c_sol)},}$)` }
    }
    return new RegExp(r)
}

    
/*===================================================================================================================\\
|                                                Search Functions
\\===================================================================================================================*/
    
function minRange(r1,r2) { return [Math.max(r1[0],r2[0]),Math.min(r1[1],r2[1])] }

function addRange(r1,r2) { return [r1[0]+r2[0],r1[1]+r2[1]] }

function getCriteria() {
    let limits = {}
    const requires = parse(document.getElementById('searchleRequires').value)
    for (let i=0; i<requires.length; i++) {
        let [val,num,inv] = requires[i]
        if (Array.isArray(val)) { throw new fError('Groupings not implimented in requires') }
        if (inv) { throw new fError('Inverse not implimented in requires') }
        if (val === null) { throw new fError('Wildcards not implimented in requires') }
        if (num === null) { num = 1 }
        if (!Array.isArray(num)) { num = [num,Infinity] }
        if (val in limits) { limits[val] = addRange(limits[val],num) }
        else { limits[val] = num }
    }
    const avoids = parse(document.getElementById('searchleAvoids').value)
    for (let i=0; i<avoids.length; i++) {
        let [val,num,inv] = avoids[i]
        if (Array.isArray(val)) { throw new fError('Groupings not implimented in avoids') }
        if (inv) { throw new fError('Inverse not implimented in avoids') }
        if (val === null) { throw new fError('Wildcards not implimented in avoids') }
        if (num === null) { num = [0,0] }
        else if (Array.isArray(num)) {
            if (num[1] !== Infinity) { throw new fError('Multi-range not implimented') }
            num = [0,num[0]-1]
        }
        else {
            num = [0,num-1]
        }
        num[1] = Math.max(0,num[1])       
        if (val in limits) { limits[val] = minRange(limits[val],num) }
        else { limits[val] = num }
    }
    let pattern = document.getElementById('searchlePattern').value
    pattern = parse(pattern)
    if (pattern.length===0 && Object.keys(limits).length>0) { pattern = [[null,[0,null],false]] }
    return [pattern,limits]
}

function getInds(list='') {
    if (list==='') {
        // group lists by setting
        let opts = {}
        for (const [key,opt] of Object.entries(options.lists.subops)) {
            if (key in wordlist.lists) {
                if (!(opt.value in opts)) { opts[opt.value] = [] } 
                opts[opt.value].push(key)
             }
        }
        let ans = new Set()
        if ('Require' in opts && opts.Require.length > 0) {
            ans = new Set(wordlist.lists[opts.Require[0]])
            for (let i=1; i<opts.Require.length; i++) { ans = setI(ans,wordlist.lists[opts.Require[i]]) }
        } else if ('Include' in opts) {
            for (const key of opts.Include) { 
                ans = setU(ans, wordlist.lists[key])
            }
        }
        if ('Avoid' in opts) {
            let avoid = new Set()
            for (const key of opts.Avoid) { avoid = setU(avoid, wordlist.lists[key]) }
            ans = setD(ans, avoid)
        }
        ans = [...ans]
        let other_req = getOption('lists.other_req')
        for (const req of other_req.split(/,|;|\n/)) {
            if (req) {
                const ereq = ordsplit(req,['==','!=','~=','>=','<=','>','<','='])
                if (ereq.length == 3) {
                    let [k,e,v] = ereq.map(s=>s.trim().toLowerCase())
                    if ('freq frequency popularity pop perecent percentile count'.split(' ').includes(v)) {
                        [k,v] = [v,k]
                        if (e.includes('>')) { e = e.replace('>','<') }
                        else { e = e.replace('<','>') }
                    }
                    if (e==='~=') { e = '!=' }
                    if (e==='=') { e = '==' }
                    v = eval(v)
                    if ('percent percentile'.split(' ').includes(k)) { k='count'; v = wordlist.words.length * v / 100 }
                    if ('count'.split(' ').includes(k)) {
                        k='freq'
                        v = Math.round(v)
                        v = (v >= wordlist.freq.length)? Infinity : wordlist.freq[v]
                    }
                    if ('freq frequency popularity pop'.split(' ').includes(k)) {
                        if (v < 1) { v = Math.round(1/v) }
                        const fun = eval('k => ' + String(v) + e + 'k')
                        ans = ans.filter(i=>fun(wordlist.freq[i]))
                    } else { throw new fError(`Unknown requirement key ${k}`) }
                } else { throw new fError(`Unknown requirement ${req}`) }
            }
        }
        ans.sort((a,b)=>a-b)
        return ans
    } else {
        return wordlist.lists[list]
    }
}

function getLooseInds(pattern, limits, r, m) {
    let ans 
    if (m==='Full') { 
        ans = getInds().map(i=>wordlist.words[i]).filter(w=>r.test(w))
    } else if (m==='Partial') {
        const r_ = pattern2regex(pattern, limits, true)
        ans = getInds().map(i=>wordlist.words[i]).filter(w=>r.test(w))
    } else { 
        ans = getInds().map(i=>wordlist.words[i])
    }
    return ans
}

function getRemaining(G, A, method='Average') {
    const N = G.length
    const M = A.length
    let S, fun
    if (method==='Average') { S = new Float32Array(N); fun = mean }
    else if (method==='Worst Case') { S = new Int32Array(N); fun = max }
    else { throw fError(`Uknown method ${method}`) }
    let i = 0
    let run = setInterval(() => {
        showPercent(i/N)
        const g = G[i]
        const s = new Int32Array(M)
        for (let j=0; j<M; j++) {
            const a = A[j]
            if (g !== a) {
                const r = guess2regex(g,a)
                s[j] = A.reduce((c,w) => (r.test(w)) ? c+1 : c, 0)
            }
        }
        S[i] = fun(s)
        i++
        if (i>=N) {
            clearInterval(run)
            showScore(G,S)
        }
    }, 1)
}

function getScores(G, A, m, method) {
    let S = []
    for (const g of G) {
        let s = 0
        for (const a of A) { s += getScore(g, a, G, A, m, method) }
        S.push(s/A.length)
    }
    return S
}

function getScore(g, a, G, A, m, method) {
    if (g===a) { return 1 }
    else {
        const r = guess2regex(g,a)
        const A_ = A.filter(w=>r.test(w))
        if (A_.length === A.length) { return NaN }
        let G_
        if (m==='Full') {
            G_ = G.filter(w=>r.test(w))
        } else if (m==='Partial') {
            const r_ = guess2looseregex(g,a)
            G_ = G.filter(w=>r_.test(w))
        } else {
            G_ = [...G]
        }
        const S = getScores(G_, A_, m, method)
        const i_min = S.reduce((Li,N,i) => S[Li]>=N ? Li : i, 0)
        const g_ = G_[i_min]
        return getScore(g_, a, G_, A_, m, method) + 1
    }
}

    
/*===================================================================================================================\\
|                                                Option Functions
\\===================================================================================================================*/    

function getFullOption(keys, force=false) {
    if (!Array.isArray(keys)) { keys = keys.split('.') }
    let opt = options
    for (let i=0; i<keys.length; i++) {
        const key = keys[i]
        if (key in opt || force) {
            if (!(key in opt)) { opt[key] = {} }            
            const op = opt[key]
            if (i == keys.length-1) { return op }
            else if ('subops' in op || force) {
                if (!('subops' in op)) { op.subops = {} }         
                opt = op.subops
            }   
            else { return undefined }
        } else { return undefined }
    }
}
 
function setFullOption(keys, val) {
    if (!Array.isArray(keys)) { keys = keys.split('.') }
    let opt = options
    for (let i=0; i<keys.length; i++) {
        const key = keys[i]
        if (!(key in opt)) { opt[key] = {} }            
        const op = opt[key]
        if (i == keys.length-1) { opt[key] = val }
        if (!('subops' in op)) { op.subops = {} }         
        opt = op.subops
    }
}    
    
function getOption(keys) { return getFullOption(keys,true).value }

function setOption(keys, val) { getFullOption(keys, true).value = val }

function applyOptions(oldOptions,newOptions) {
    for (let [key,obj0] of Object.entries(oldOptions)) { 
        if (key in newOptions) {
            const obj1 = newOptions[key]
            if (typeof obj1 === 'object' && !Array.isArray(obj1) && obj1 !== null) {
                if ('value' in obj0 && 'value' in obj1) {
                    if (JSON.stringify(obj0.type) === JSON.stringify(obj1.type)) { obj0.value = obj1.value }
                }
                if ('subops' in obj0 && 'subops' in obj1) { applyOptions(obj0.subops,obj1.subops) }
            }      
        }
    }
}
    
    
/*===================================================================================================================\\
|                                                 HTML Functions
\\===================================================================================================================*/
    
function hitKey(e) { if (e.keyCode == 13) { searchleClick() } }

let active_tab = null

function activeTab(name) {
    if (name !== active_tab) {
        active_tab = name
        for (let e of document.getElementsByClassName('box')) { e.style.display = 'none' }
        for (let e of document.getElementsByClassName('tabBtn')) { e.className = e.className.replace(' active','') }
        document.getElementById('box'+name).style.display = 'block'
        for (let e of document.getElementsByClassName('tabBtn')) {
            if (e.innerHTML == name) { e.className += ' active' }
        }
    }
}

function tabClick(event) {
    const name = event.srcElement.innerHTML
    activeTab(name)
}

let changeEvents = {}
    
function changeOption(keys,val) {
    setOption(keys,val)
    setCookie('options',options)
    if (Array.isArray(keys)) { keys = keys.join('.') }
    if (keys in changeEvents) {
        let [value,frame] = changeEvents[keys]
        if ((Array.isArray(value) && value.includes(val)) || val === value) {
            frame.style.display = 'block'
        }
        else { frame.style.display = 'none' }
    }
}
    
function createOption(option, keys, parent) {
    const frame = document.createElement('div')
    const id = keys.join('.')
    let label = keys[keys.length-1]
    if ('label' in option) { label = option.label }
    if ('value' in option) {
        let subframe = document.createElement('span')
        subframe.style.display = 'flex'
        let element
        if ('type' in option) {
            if (Array.isArray(option.type)) {
                element = document.createElement('select', {id: id})
                for (const val of option.type) {
                    const E = document.createElement('option', {value: val})
                    E.appendChild(document.createTextNode(val))
                    element.appendChild(E) 
                }
                element.value = option.value
                element.onchange = (e) => changeOption(id, e.target.value)  
            } else {
                throw new fError(`Unable to parse option wtih type ${option.type}`)
            }
        } else {
            if (typeof option.value === 'boolean') {
                element = document.createElement('input', {id: id})
                element.type = 'checkbox'
                element.checked = option.value 
                element.onchange = (e) => changeOption(id, e.target.checked)
            } else if (typeof option.value === 'string') {
                element = document.createElement('input', {id: id})
                element.type = 'text'
                element.value = option.value 
                element.onchange = (e) => changeOption(id, e.target.value) 
            } else if (typeof option.value === 'number') {
                element = document.createElement('input', {id: id})
                element.type = 'number'
                element.value = option.value
                element.onchange = (e) => changeOption(id, e.target.value)  
            } else {
                throw new fError(`Unable to parse option wtih value ${option.value}`)
            }
        }
        const L = document.createElement('label')
        if ('pos' in option && option.pos=='left') {
            L.appendChild(document.createTextNode(label))
            L.style.marginLeft = '2%'
            subframe.appendChild(element)
            subframe.appendChild(L)
        } else {
            L.appendChild(document.createTextNode(label+':'))
            L.style.marginRight = '2%'
            subframe.appendChild(L) 
            subframe.appendChild(element)
        }
        frame.appendChild(subframe)
    } else {
        if (label) { frame.appendChild(document.createTextNode(label)) }
    }
    if ('subops' in option) {
        let subframe = document.createElement('div')    
        subframe.style.marginLeft = '5%'
        createOptions(option.subops,keys,subframe)
        frame.appendChild(subframe)
    }
    if ('require' in option) {
        let [src_id,val] = option.require
        if (Array.isArray(src_id)) { src_id = src_id.join('.') }
        changeEvents[src_id] = [val,frame]
    }
    parent.appendChild(frame)
}

function createOptions(options, keys=null, parent=null) {
    if (keys === null) { keys = [] }
    if (parent === null) { parent = document.getElementById('boxOptions') }
    for (const [key,option] of Object.entries(options)) {
        createOption(option, keys.concat(key), parent)
    }
}

function startOptions() {
    createOptions(options)
    for (const [k, e] of Object.entries(changeEvents)) { changeOption(k, getOption(k)) }
    const L = document.createElement('label')
    L.appendChild(document.createTextNode(`${version}`))
    const P = document.getElementById('boxOptions')
    P.appendChild(document.createElement('br'))
    P.appendChild(L)
}

function dispStatus(msg) {
    document.getElementById('searchleResult').innerHTML = msg
}

function dispResult(ans) {
    if (getOption('sort.show') && ans.length>1) {
        ans = ans.map(A => {
            if (arrayType(A)==='float') { return A.map(v=>v.toFixed(3)) }
            else { return A.map(v=>String(v)) }
        })
        ans = transpose(ans).map(a=>a.join(' - '))
    } else { ans = ans[0] }
    activeTab('Results')
    dispStatus(ans.join('\n'))
}

let last_p = NaN
function showPercent(p) {
    p = Math.round(p*1000)/10
    if (p !== last_p) {
        dispStatus(`Searchling ${p}%`)
        last_p = p
    }    
}

function showScore(W,S) {
    let WS = [W, S]
    WS = sortByCol(WS, 1)
    dispResult(WS)
}

    
/*===================================================================================================================\\
|                                                 Main Function
\\===================================================================================================================*/

function searchle() {
    const [pattern, limits] = getCriteria()
    console.log([pattern,limits])
    if (pattern.length===0 && Object.keys(limits).length===0) { return [[]] }
    const r = pattern2regex(pattern, limits)
    const sort = getOption('sort.order')
    if (sort === 'Alphabetical') {
        const words = getInds().map(i=>wordlist.words[i]).filter(w=>r.test(w))
        words.sort()
        dispResult(words)
    } else if (sort === 'Popularity') {
        let ans = []
        const inds = getInds().filter(i=>r.test(wordlist.words[i]))
        const words = inds.map(i=>wordlist.words[i])
        ans.push(words)
        if (getOption('sort.show')) {
            const N = wordlist.freq.length
            const max_count = wordlist.freq[N-1]
            const freq = inds.map(i => (i<N)? `1 / ${wordlist.freq[i]}` : `1 / ${max_count}+`)
            ans.push(freq)
        }
        dispResult(ans)
    } else if (sort === 'Remaining Words') {
        const m = getOption('sort.score.match')
        const G = getLooseInds(pattern, limits, r, m)
        const A = getInds(getOption('sort.score.list')).map(i=>wordlist.words[i]).filter(w=>r.test(w))
        const criteria = getOption('sort.score.criteria')
        getRemaining(G, A, criteria)
    } else if (sort === 'Score') {
        throw new fError('Score search not implemented')
    }
} 

function searchleClick() {
    try {
        activeTab('Results')
        dispStatus('Begining Search')
        searchle()
    } catch (error) {
        activeTab('Results')
        if (error.name==='fError') { dispStatus(String(error.msessage)) }
        else { console.log(error);  dispStatus(`Error with searchle function:\n${error.message}`) }
    }
}


/*===================================================================================================================\\
|                                                     Setup
\\===================================================================================================================*/

let cookies
let wordlist
let helptext

async function searchleStart() {

    // get data
    wordlist = await fetch(wordlistUrl).then(response => response.json())
    helptext = await fetch(helptextUrl).then(response => response.text())

    // add info
    document.getElementById('boxInfo').innerHTML = helptext.replaceAll('\n', '<br>')
    activeTab('Info')

    // add list options options
    cookies = getCookies()
    for (const list in wordlist['lists']) {
        setFullOption(['lists', list], {value: 'Include', type: ['Require', 'Include', 'Nothing', 'Avoid'], pos: 'left'})
        getFullOption('sort.score.list').type.push(list)
    }
    setFullOption(['lists', 'other_req'], { label: 'Adv Req', value: '' })
    if ('options' in cookies) { applyOptions(options, cookies.options) }
    setCookie('options', options)
    startOptions(options)

    // attach button events
    document.getElementById('searchleBtn').onclick = searchleClick
    for (const e of document.getElementsByClassName('tabBtn')) { e.onclick = tabClick }
    for (const e of document.getElementsByClassName('searchInp')) { e.addEventListener('keyup', hitKey) }

    // print info
    console.log(`Loaded Serachle ${version}`)

}

searchleStart()


/*===================================================================================================================\\
|                                                Service Worker
\\===================================================================================================================*/

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('service-worker.js')
            .then(function(registration) {
            console.log('ServiceWorker registration successful with scope: ', registration.scope)
        }, function(err) {
            console.log('ServiceWorker registration failed: ', err)
        })
    })
}


/*===================================================================================================================\\
|                                               General Functions
\\===================================================================================================================*/

function replace(str,old_chars,new_cha) {
    for (const c of old_chars) { str = str.replaceAll(c,new_cha) }
    return str
}

function delimsplit(str,substr) {
    if (Array.isArray(substr)) { substr = `(?:${substr.join('|')})` }
    return new RegExp(`(?=${substr})|(?<=${substr})`,'g')
}

function ordsplit(str,substrs) {
    for (const substr of substrs) {
        if (str.includes(substr)) {
            return str.split(substr)
                .map(s=>ordsplit(s,substrs))
                .reduce((a,s)=>a.concat([substr,...s]))
        }
    }
    return [str]
}

function countStr(str,sub) { return str.split(sub).length - 1 }   

function setU(s1,s2) { return new Set([...s1,...s2]) }

function setI(s1,s2) { s2 = new Set(s2); return new Set([...s1].filter(e=>s2.has(e))) }

function setD(s1,s2) { s2 = new Set(s2); return new Set([...s1].filter(e=>!s2.has(e))) }

function sortByCol(arrays, ind, reverse=false) {
    let inds = [...arrays[0].keys()]        
    if (reverse) { inds.sort((a,b) => arrays[ind][a] < arrays[ind][b] ? 1 : -1) }
    else { inds.sort((a,b) => arrays[ind][a] > arrays[ind][b] ? 1 : -1) }
    return arrays.map(A=>inds.map(i=>A[i]))
}

function mean(args) { return args.reduce((s,a)=>s+a,0)/args.length }

function min(args) { return Math.min(...args) }

function max(args) { return Math.max(...args) }

function arrayType(args) {
    const t = typeof args[0]
    if (t === 'number') {
        if (args.some(arg => arg % 1 !== 0)) { return 'float' }
        else { return 'integer' }        
    } else { return t }
}

function transpose(A) { return A[0].map((_,c) => A.map(R => R[c])) }

function setCookie(key,val,days=30) {
    const d = new Date()
    d.setTime(d.getTime() + (days*24*60*60*1000))
    document.cookie = key + '=' + JSON.stringify(val) + '; expires=' + d.toUTCString()  
}

function setCookies(cookies,days=30) {
    for (const [key,val] of Object.entries(cookies)) { setCookie(key,val,days) }
}
    
function getCookies() {
    const rawCookies = document.cookie
    let cookies = {}
    for (const str of rawCookies.split(';')) {
        if (str) {
            const strs = str.split('=')
            const key = strs[0]
            const val = strs.slice(1).join('=')
            try {
                cookies[key.trim()] = JSON.parse(val.trim())
            } catch (error) { console.log(`Error parsing cookie ${key}`); console.log(error) }
        }
    }
    return cookies
}

function fError(msg) {
    this.message = msg
    this.name = 'fError'
}
