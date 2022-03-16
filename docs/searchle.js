/*===================================================================================================================\\
|                                                 Settings
\\===================================================================================================================*/

const version = 'v0.2.7'

let options = {
    sort: {
        label: 'Sorting Options:',
        subops: {
            show: { label: 'Show Value', value: false, },
            order: { label: 'Order', value: 'Frequency', type: ['Frequency', 'Alphabetical', 'Score'], },     
            score: { 
                label: '',
                require: ['sort.order','Score'],
                subops: {
                    deep: { label: 'Deep Search', value: true, require: ['sort.order', 'Score'],},
                    match: { label: 'Req Match', value: 'Full', type: ['Full', 'Partial', 'None'], require: ['sort.order', 'Score'],},
                    list: { label: 'Alt List', value: '', type: [''], require: ['sort.order', 'Score'],},
                },
            },
        },
    },
    lists: {
        label: 'Word Lists:',
        subops: {
            other_req: { label: 'Other Req', value: '' },
        },
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

function val2regex(val, num, inv, loose) {
    let r = ''
    if (Array.isArray(val)) {
        if (val.every(([v,n,i]) => {
            return (!Array.isArray(v) 
                    && v.length===1 
                    && (n===null 
                        || n===1 
                        || (Array.isArray(n) && n[0]===1 && n[1]===1)
                        )
                    )
        })) {
            r += '['
            if (inv) { r += '^' }
            r += val.map(([v,n,i])=>v).join('') + ']'
        } else {
            if (inv) { throw 'Complex Inverse Grouping not Implimented' }
            val = val.map(([v,n,i])=> val2regex(v,n,i,loose) )
            r += '(?:' + val.join('|') + ')'
        }
    } else {
        if (val === null) { val = '.' }
        if (inv) {
            if (val.length==1) {
                if (loose) { r += '.' }
                else { r += '[^' + val + ']' }
            } else {
                if (loose) { r += '.' }
                else { r += '(?:(?!'+val+').)' }
                if (num === null) { r += '{'+String(val.length)+'}' }
            }
        } else {
            if (num === null || val.length==1) { r += val }
            else { r += '(?:'+val+')' }
        }        
    }
    if (num !== null) {
        if (Array.isArray(num)) {
            if (num[1]===Infinity || isNaN(num[1]) || num[1]===null) { 
                r += '{'+String(num[0])+',}'
            }
            else { r += '{'+String(num[0])+','+String(num[1])+'}' }                    
        } else {
            r += '{'+String(num)+'}'
        }
    }
    return r
}

function pattern2regex(pattern, limits, loose=false) {
    let r = ''
    for (const [num, val, inv] of pattern) { r += val2regex(num, val, inv, loose) }
    r = `(?=^${r}$)`
    for (const L in limits) {
        let [min, max] = limits[L]
        min = String(min)
        max = (max===Infinity || isNaN(max) || max===null) ? '' : String(max)
        if (L.length <= 1) { r += `(?=^[^${L}]*(?:${L}[^${L}]*){${min},${max}}$)` }
        else { r += `(?:(?!${L}).)*(?:${L}(?:(?!${L}).)*)` }
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
        if (c_guess <= c_sol) { r += `(?=^[^${L}]*(?:${L}[^${L}]*){${c_guess},}$)` }
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
        if (Array.isArray(val)) { throw 'Groupings not implimented in requires' }
        if (inv) { throw 'Inverse not implimented in requires' }
        if (val === null) { throw 'Wildcards not implimented in requires' }
        if (num === null) { num = 1 }
        if (!Array.isArray(num)) { num = [num,Infinity] }
        if (val in limits) { limits[val] = addRange(limits[val],num) }
        else { limits[val] = num }
    }
    const avoids = parse(document.getElementById('searchleAvoids').value)
    for (let i=0; i<avoids.length; i++) {
        let [val,num,inv] = avoids[i]
        if (Array.isArray(val)) { throw 'Groupings not implimented in avoids' }
        if (inv) { throw 'Inverse not implimented in avoids' }
        if (val === null) { throw 'Wildcards not implimented in avoids' }
        if (num === null) { num = [0,0] }
        else if (Array.isArray(num)) {
            if (num[1] !== Infinity) { throw 'Multi-range not implimented' }
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
                const ereq = req.split(/(<|>|<=|>=)/)
                if (ereq.length == 3) {
                    let [k,e,v] = ereq.map(s=>s.trim().toLowerCase())
                    if ('f p c freq frequency perecent percentile count'.split(' ').includes(v)) {
                        [k,v] = [v,k]
                        if (e.includes('>')) { e = e.replace('>','<') }
                        else { e = e.replace('<','>') }
                    }
                    v = eval(v)
                    if ('p percent percentile'.split(' ').includes(k)) { k='c'; v = wordlist.words.length * v / 100 }
                    if ('c count'.split(' ').includes(k)) { k='f'; v = wordlist.freq[Math.round(v)] }
                    if ('f freq frequency'.split(' ').includes(k)) {
                        const fun = eval('k => k' + e + String(v))
                        ans = ans.filter(i=>fun(wordlist.freq[i]))
                    } else { throw `Unknown requirement key ${k}` }
                } else { throw `Unknown requirement ${req}` }
            }
        }
        console.log(ans)
        ans.sort().reverse()
        console.log(ans)
        return ans
    } else {
        return wordlist.lists[list]
    }
}

function getShallowScores(G, A) {
    let S = []
    for (const g of G) {
        let s = 0
        for (const a of A) {
            if (g !== a) {
                const r = guess2regex(g,a)
                s += A.reduce((c,w) => (r.test(w)) ? c+1 : c, 0) 
            }
            s += 1
        }
        S.push(s/A.length)
    }
    return S
}

function getScores(G, A, m) {
    let S = []
    for (const g of G) {
        let s = 0
        for (const a of A) { s += getScore(g, a, G, A, m) }
        S.push(s/A.length)
    }
    return S
}

function getScore(g, a, G, A, m) {
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
        const S = getScores(G_, A_, m)
        const i_min = S.reduce((Li,N,i) => S[Li]>=N ? Li : i, 0)
        const g_ = G_[i_min]
        return getScore(g_, a, G_, A_, m) + 1
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
    
function hitKey(e) { if (e.keyCode == 13) { searchle() } }

function activeTab(name) {
    for (let e of document.getElementsByClassName('box')) { e.style.display = 'none' }
    for (let e of document.getElementsByClassName('tabBtn')) { e.className = e.className.replace(' active','') }
    document.getElementById('box'+name).style.display = 'block'
    for (let e of document.getElementsByClassName('tabBtn')) {
        if (e.innerHTML == name) { e.className += ' active' }
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
        if (val == value) { frame.style.display = 'block' }
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
                throw `Unable to parse option wtih type ${option.type}`
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
                throw `Unable to parse option wtih value ${option.value}`
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
}
    
function showPercent(p) {
    p = Math.round(p)
    document.getElementById('searchleResult').innerHTML = '█'.repeat(p) + '░'.repeat(100-p)
}

function dispResult(ans) {
    if (getOption('sort.show') && ans.length>1) {
        const A = [...ans.keys()].slice(1)
        ans = ans[0].map((w,i)=>[w,...A.map(a=>ans[a][i])].join('  -  '))
    } else {
        ans = ans[0]
    }
    document.getElementById('searchleResult').innerHTML = ans.join('\n')
    activeTab('Results')
}

    
/*===================================================================================================================\\
|                                                 Main Function
\\===================================================================================================================*/

function searchle() {
    const [pattern, limits] = getCriteria()
    console.log([pattern,limits])
    const r = pattern2regex(pattern, limits)
    let ans = []
    const sort = getOption('sort.order')
    if (sort === 'Alphabetical') {
        const words = getInds().map(i=>wordlist.words[i]).filter(w=>r.test(w))
        words.sort()
        ans.push(words)
    } else if (sort === 'Frequency') {
        const inds = getInds().filter(i=>r.test(wordlist.words[i]))
        const words = inds.map(i=>wordlist.words[i])
        ans.push(words)
        if (getOption('sort.show')) {
            const min_freq = wordlist.freq.reduce((m,f) => (f>0 && f<m)?f:m, 1)
            const max_den = parseInt(1/min_freq) + 1
            const freq = inds.map(i=>wordlist.freq[i]).map(f => (f>0) ? `1/${Math.round(1/f)}` : `1/${max_den}+`)
            ans.push(freq)
        }
    } else if (sort === 'Score') {
        const m = getOption('sort.score.match')
        let G 
        if (m==='Full') { 
            G = getInds().map(i=>wordlist.words[i]).filter(w=>r.test(w))
        } else if (m==='Partial') {
            const r_ = pattern2regex(pattern, limits, true)
            G = getInds().map(i=>wordlist.words[i]).filter(w=>r.test(w))
        } else { 
            G = getInds().map(i=>wordlist.words[i])
        }
        const A = getInds(getOption('sort.score.list')).map(i=>wordlist.words[i]).filter(w=>r.test(w))
        let scores
        if (getOption('sort.score.deep')) { 
            // scores = getScores(G, A, m) 
            scores = A.map((w,i)=>i)
        } else { 
            scores = getShallowScores(G, A)
        }
        let wrdscrs = [G, scores]
        wrdscrs = sortByCol(wrdscrs, 1)
        ans.push(...wrdscrs)
    }
    dispResult(ans)
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
    if ('options' in cookies) { applyOptions(options, cookies.options) }
    setCookie('options', options)
    startOptions(options)

    // attach button events
    document.getElementById('searchleBtn').onclick = searchle  
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

function setU(s1,s2) { return new Set([...s1,...s2]) }

function setI(s1,s2) { s2 = new Set(s2); return new Set([...s1].filter(e=>s2.has(e))) }

function setD(s1,s2) { s2 = new Set(s2); return new Set([...s1].filter(e=>!s2.has(e))) }

function countStr(str,sub) { return str.split(sub).length - 1 }   
    
const letterList = 'abcdefghijklmnopqrstuvwxyz'  

function sortByCol(arrays, ind, reverse=false) {
    let inds = [...arrays[0].keys()]        
    if (reverse) { inds.sort((a,b) => arrays[ind][a] < arrays[ind][b] ? 1 : -1) }
    else { inds.sort((a,b) => arrays[ind][a] > arrays[ind][b] ? 1 : -1) }
    return arrays.map(A=>inds.map(i=>A[i]))
}

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
            const [key,val] = str.split('=')
            cookies[key.trim()] = JSON.parse(val.trim())    
        }
    }
    return cookies
}

