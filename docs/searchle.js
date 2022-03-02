async function searchleMain(document) {

/*===================================================================================================================\\
|                                                 Settings
\\===================================================================================================================*/

const version = 'v0.1.5'

let options = { 
    sort: {
        label: 'Sorting Options:',
        subops: {
            order: { label: 'Order', value: 'Frequency', type: ['Frequency', 'Alphabetical', 'Score'], },      
            show: { label: 'Show Value', value: false, },
            score: { 
                label: '',
                require: [['sort','order'],'Score'],
                subops: {
                    deep: { label: 'Deep Search', value: true, },
                    match: { label: 'Req Match', value: 'Full', type: ['Full', 'Partial', 'None'], },
                    list: { label: 'Alt List', value: '', type: [''], },
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

// get data
const wordlistUrl = 'https://raw.githubusercontent.com/Squishiest-Grape/Searchle/main/data/wordlist.json'
const wordlist = await fetch(wordlistUrl).then(response => response.json())
const helptextUrl = 'https://raw.githubusercontent.com/Squishiest-Grape/Searchle/main/docs/help.txt'
const helptext = await fetch(helptextUrl).then(response => response.text())
    

/*===================================================================================================================\\
|                                                  Parse Functions
\\===================================================================================================================*/

// main parser
function parse(str) {
    str = str.toLowerCase()
    str = replace(str,' ,','')
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
            if (cha == mode) { mode = 'done' }
            else { val += cha }
        // handle groups
        } else if ('(['.includes(mode)) {
            if (cha == mode ) { depth -= 1 }
            if ((mode=='[' && cha==']')||(mode=='(' && cha==')')) { depth += 1 }
            if (depth != 0) { val += cha }
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
                    if (num == null) { num = cha }
                    else if (typeof num == 'string') { num += cha }
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
        // handle saving new value
        if (mode == 'done') {
            if (Array.isArray(num)) { num = num.map(i => parseInt(i)) }
            else if (num != null) { num = parseInt(num) }
            ANS.push([num,val,inv])
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
        else if (num != null) { num = parseInt(num) }
        ANS.push([num,null,inv])
    }
    return ANS
}

// parse to string
function pattern2regex(pattern,ignoreGroup=false) {
    let ans = ''
    for (let [num,val,inv] of pattern) {
        if (Array.isArray(val)) {
            if (ignoreGroup) {
                ans += '.'
            } else {
                ans += '['
                if (inv) { ans += '^' }
                ans += val.map(v=>pattern2regex([v])).join('|')
                ans += ']' 
            }
        } else {
            if (val == null) { val = '.' }
            if (inv) {
                if (ignoreGroup) { ans += '.' }
                else { ans += '[^' + val + ']' }
            } else { ans += val }                
        }
        if (num != null) {
            if (Array.isArray(num)) {
                if (isNaN(num[1])) { ans += '{'+String(num[0])+',}' }
                else { ans += '{'+String(num[0])+','+String(num[1])+'}' }                    
            } else {
                ans += '{'+String(num)+'}'
            }
        }
    }
    return new RegExp('^'+ans+'$')
}

function c_pattern2regex(c_pattern,ignoreGroups=false) {
    let ans = ''
    for (const c of c_pattern) {
        if (c.length==1) { ans += c } 
        else { 
            if (ignoreGroups) { ans += '.' }
            else { ans += '[' + c + ']'}
        }
    } 
    return new RegExp('^'+ans+'$')
}

function cleanPattern(pattern) {
    let c_pattern = []
    for (let [num,val,inv] of pattern) {
        if (num === null) { num = 1 }
        if (Array.isArray(num)) {
            if (num[0] === num[1]) { num = num[0] }
            else { throw 'Unable to clean pattern for number range' }
        }
        for (let c=0; c<num; c++) {
            let V = letterList               
            if (val !== null) {
                if (!Array.isArray(val)) { val = [val] }
                for (const v of val) { if (v.length != 1) { throw `Unable to clean pattern for '${v}'` } }
                if (inv) { for (const v of val) { V = V.replace(v,'') } }
                else { V = [...new Set(val)].join('') }
            }
            c_pattern.push(V)
        }
    }
    return c_pattern
}
    
    
/*===================================================================================================================\\
|                                                Search Functions
\\===================================================================================================================*/
    
function combRange(r1,r2) {
    let r = [r1[0],r1[1]]
    if (r2[0] > r[0]) { r[0] = r2[0] }
    if (r[1] == NaN || r2[1] < r[1]) { r[1] = r2[1] }
    return r
}

function getCriteria() {
    let limits = {}
    const requires = parse(document.getElementById('searchleRequires').value)
    for (let i=0; i<requires.length; i++) {
        let [num,val,inv] = requires[i]
        if (Array.isArray(val)) { throw 'Groupings not implimented in requires' }
        if (inv) { throw 'Inverse not implimented in requires' }
        if (val == null) { throw 'Wildcards not implimented in requires' }
        if (num == null) { num = 1 }
        if (!Array.isArray(num)) { num = [num,NaN] }
        if (val in limits) { limits[val] = combRange(val,num) }
        else { limits[val] = num }
    }
    const avoids = parse(document.getElementById('searchleAvoids').value)
    for (let i=0; i<avoids.length; i++) {
        let [num,val,inv] = avoids[i]
        if (Array.isArray(val)) { throw 'Groupings not implimented in avoids' }
        if (inv) { throw 'Inverse not implimented in avoids' }
        if (val == null) { throw 'Wildcards not implimented in avoids' }
        if (num == null) { num = [0,0] }
        else if (Array.isArray(num)) {
            if (num[1] != NaN) { throw 'Multi-range not implimented' }
            num = [0,num[0]-1]
        }
        else {
            num = [0,num-1]
        }
        num[1] = Math.max(0,num[1])       
        if (val in limits) { limits[val] = combRange(val,num) }
        else { limits[val] = num }
    }
    let pattern = document.getElementById('searchlePattern').value
    pattern = parse(pattern)
    return [pattern,limits]
}

function getInds(list='') {
    if (list==='') {
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
        let other_req = getOption(['lists','other_req'])
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
        return ans
    } else {
        return wordlist.lists[list]
    }
}

function search(inds, pattern, limits=null) {
    if (limits === null) {
        const r = pattern2regex(pattern,true)
        return inds.filter(i=>r.test(wordlist.words[i]))
    } else {                                  
        const r = pattern2regex(pattern)
        let ans = [] 
        for (const i of inds) {
            const word = wordlist.words[i]
            if (r.test(word)) {
                let good = true
                for (const part in limits) {
                    let c = (word.match(new RegExp(part,'g')) || []).length
                    if (c < limits[part][0] || c > limits[part][1]) { good = false; break }
                }
                if (good) { ans.push(i) } 
            }
        }
        return ans
    }
}

function c_search(words, c_pattern, limits=null) {   
    if (limits === null) {
        const r = c_pattern2regex(c_pattern,true)
        return words.filter(w=>r.test(w))
    } else {
        const r = c_pattern2regex(c_pattern)
        let ans = []
        for (const word of words) {
            if (r.test(word)) {
                let good = true
                for (const L in limits) {
                    const c = countStr(word,L)
                    if (c < limits[L][0] || c > limits[L][1]) { good = false; break }
                }
                if (good) { ans.push(word) } 
            }
        }
        return ans
    }
}

function newCriteria(guess, sol, pattern, limits) {
    let n_pattern = [...pattern]
    let n_limits = {}
    for (const [k,v] of Object.entries(limits)) { n_limits[k] = [...v] }
    let check = new Set()
    let G = ''
    for (let c=0; c<guess.length; c++) {
        const L = guess[c]
        if (L === sol[c]) {
            n_pattern[c] = L
            G += L
        } else { 
            n_pattern[c] = n_pattern[c].replace(L,'')
            check.add(L)
        }
    }
    for (const L of check) {
        const cS = countStr(sol,L)
        const cG = countStr(G,L)
        if (cG == cS) { 
            delete n_limits[L]
        } else {
            const c = countStr(guess,L) 
            if (c > cS) { 
                n_limits[L] = [cS,cS]
            } else {
                let num = [0,NaN]
                if (L in n_limits) { num = n_limits[L] }
                n_limits[L] = [c,num[1]]
            }
        }
    }
    return [n_pattern, n_limits]    
}

function getWords(words, match, pattern, limits) {
    if (match == 'Full') { words = c_search(words, pattern, limits) }            
    else if (match == 'Partial') { words = c_search(words, pattern) } 
    else { words = [...words] }
    return words
}

function getScores(words, pot_sol, pattern, limits) {
    let ans = []
    for (const guess of words) {
        let score = 0
        for (const sol of pot_sol) {
            if (guess !== sol) {
                const [n_pattern, n_limits] = newCriteria(guess, sol, pattern, limits)
                score += c_search(pot_sol, n_pattern, n_limits).length                 
            }
            score += 1
        }
        ans.push(score/pot_sol.length)
    }
    return ans
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
    
function getOption(keys) { return getFullOption(keys).value }

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
    
function hitKey(e) {
    if (e.keyCode == 13) { searchle() }
}

function activeTab(name) {
    for (let e of document.getElementsByClassName('box')) { e.style.display = 'none' }
    for (let e of document.getElementsByClassName('tabBtn')) { e.className = e.className.replace(' active','') }
    document.getElementById('box'+name).style.display = 'block';
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
                element.onchange = (e) => changeOption(id, e.srcElement.value)  
            } else {
                throw `Unable to parse option wtih type ${option.type}`
            }
        } else {
            if (typeof option.value === 'boolean') {
                element = document.createElement('input', {id: id})
                element.type = 'checkbox'
                element.checked = option.value 
                element.onchange = (e) => changeOption(id, e.srcElement.checked)
            } else if (typeof option.value === 'string') {
                element = document.createElement('input', {id: id})
                element.type = 'text'
                element.value = option.value 
                element.onchange = (e) => changeOption(id, e.srcElement.value) 
            } else if (typeof option.value === 'number') {
                element = document.createElement('input', {id: id})
                element.type = 'number'
                element.value = option.value
                element.onchange = (e) => changeOption(id, e.srcElement.value)  
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
        let [src_id,val] = options.require
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
    for (const [k,e] of Object.entries(changeEvents)) { changeOption(k,getOption(k)) }
}
    
    
    
/*===================================================================================================================\\
|                                                 Main Function
\\===================================================================================================================*/

function searchle() {
    let [pattern, limits] = getCriteria()
    let ans = []
    const sort = getOption(['sort', 'order'])
    const show = getOption(['sort', 'show'])
    if (sort === 'Alphabetical') {
        const inds = search(getInds(), pattern, limits)
        const words = inds.map(i=>wordlist.words[i])
        words.sort()
        ans.push(words)
    } else if (sort === 'Frequency') {
        const inds = search(getInds(), pattern, limits)
        const words = inds.map(i=>wordlist.words[i])
        ans.push(words)
        if (show) {
            let max = wordlist.lists['Exquisite Corpus'][wordlist.lists['Exquisite Corpus'].length-1]
            max = parseInt(1/wordlist.freq[max]) + 1
            const freq = inds.map(i=>wordlist.freq[i]).map(f => (f>0) ? `1 / ${Math.round(1/f)}` : `1 / ${max}+`)
            ans.push(freq)
        }
    } else if (sort === 'Score') {
        pattern = cleanPattern(pattern)
        const match = getOption(['sort', 'score', 'match'])
        let pot_sol = getInds(getOption(['sort', 'score', 'list'])).map(i=>wordlist.words[i])
        pot_sol = c_search(pot_sol, pattern, limits)
        let words = getInds().map(i=>wordlist.words[i])
        words = getWords(words, match, pattern, limits)
        let scores = getScores(words, pot_sol, pattern, limits)
        let temp = [words,scores]
        temp = sortByCol(temp,1)
        ans.push(temp[0])
        if (show) { ans.push(temp[1]) }
    }
    const A = [...ans.keys()].slice(1)
    ans = ans[0].map((w,i)=>[w,...A.map(a=>ans[a][i])].join('   -   ')).join('\n')
    document.getElementById('searchleResult').innerHTML = ans
    activeTab('Results')
} 

// add info
document.getElementById('boxInfo').innerHTML = helptext.replaceAll('\n','<br>')
activeTab('Info')

// add list options options
let cookies = getCookies()
for (const list in wordlist['lists']) {
    setFullOption(['lists', list], {value: 'Include', type: ['Require', 'Include', 'Nothing', 'Avoid'], pos: 'left',})
    getFullOption(['sort','score','list']).type.push(list)
}
if ('options' in cookies) { applyOptions(options,cookies.options) }
setCookie('options',options)
startOptions(options)

// attach button events
document.getElementById('searchleBtn').onclick = searchle  
for (const e of document.getElementsByClassName('tabBtn')) { e.onclick = tabClick }
for (const e of document.getElementsByClassName('searchInp')) { e.addEventListener('keyup', hitKey) }

// print info
console.log(`Loaded Serachle ${version}`)
    
}


/*===================================================================================================================\\
|                                               General Functions
\\===================================================================================================================*/

function replace(str,old_chars,new_cha) {
    for (const c of old_chars) { str = str.replaceAll(c,new_cha) }
    return str
}

function setU(s1,s2) {
    return new Set([...s1,...s2])
}

function setI(s1,s2) {
    s2 = new Set(s2)
    return new Set([...s1].filter(e=>s2.has(e)))
}

function setD(s1,s2) {
    s2 = new Set(s2)
    return new Set([...s1].filter(e=>!s2.has(e)))
}

function countStr(str,sub) {
    return str.split(sub).length -1    
}   
    
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

