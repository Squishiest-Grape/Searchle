const version = 'v0.1.4'

const wordlistUrl = 'https://raw.githubusercontent.com/Squishiest-Grape/Searchle/main/data/wordlist.json'
const helptextUrl = 'https://raw.githubusercontent.com/Squishiest-Grape/Searchle/main/docs/help.txt'

let options = {
    sort: {
        label: 'Sorting Options:',
        subops: {
            order: {
                label: 'Order',
                value: 'Frequency',
                type: ['Frequency', 'Alphabetical', 'Score'],
            },      
            show: {
                label: 'Show Value',
                value: false,
            },
            score: {
                label: 'Score Sort Options:',
                subops: {
                    deep: {
                        label: 'Deep Search',
                        value: true,
                    },
                    wide: {
                        label: 'Match Requirement',
                        value: 'Full',
                        type: ['Full', 'Partial', 'None'],                        
                    },
                    list: {
                        label: 'Alt List',
                        value: '',
                        type: [''],
                    },
                },
            },
        },
    },
    lists: {
        label: 'Word Lists:',
        subops: {},
    },
}  

async function searchleMain(document) {

    // replacement helper function
    function replace(str,old_chars,new_cha) {
        for (const c of old_chars) { str = str.replaceAll(c,new_cha) }
        return str
    }
    
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
            let freq = getOption(['lists','Frequency'])
            freq = freq.split(/(<|>|<=|>=)/)
            if (freq.length == 3) {
                freq = freq.map(s=>s.trim().toLowerCase())
                let f, d, v, fun
                if ('fpc'.includes(freq[0])) {  [f,d,v] = freq }
                else if ('fpc'.includes(freq[2])) {
                    [v,d,f] = freq
                    if (d.includes('>')) { d = d.replace('>','<') }
                    else { d = d.replace('<','>') }
                } else { throw `Unknown characters ${freq} in frequency limit` }
                v = eval(v)
                if (f == 'p') { f = 'c'; v = wordlist.words.length * v / 100 }
                if (f == 'c') { f = 'f'; v = wordlist.freq[Math.round(v)] }
                if (f == 'f') { fun = eval('f => f' + d + String(v)) }
                else { throw `Unknown character ${f} in frequency limit` }
                ans = ans.filter(i=>fun(wordlist.freq[i]))
            }
            return ans
        } else {
            return wordlist.lists[list]
        }
    }
    
    function search(inds,pattern,limits=null) {
        let ans = []    
        if (limits === null) {
            const r = pattern2regex(pattern,true)
            ans = inds.filter(i=>r.test(wordlist.words[i]))
        } else {
            const r = pattern2regex(pattern)
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
        }
        return ans
    }
    
    
    function c_search(inds, c_pattern, limits=null) {
        let ans = []    
        if (limits === null) {
            const r = c_pattern2regex(c_pattern,true)
            ans = inds.filter(i=>r.test(wordlist.words[i]))
        } else {
            const r = c_pattern2regex(c_pattern)
            for (const i of getInds()) {
                const word = wordlist.words[i]
                if (r.test(word)) {
                    let good = true
                    for (const L in limits) {
                        const c = countStr(word,L)
                        if (c < limits[L][0] || c > limits[L][1]) { good = false; break }
                    }
                    if (good) { ans.push(i) } 
                }
            }
        }
        return ans
    }
    

    const letterList = 'abcdefghijklmnopqrstuvwxyz'  

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

    
    function newCriteria(guess, sol, pattern, limits) {
        guess = wordlist.words[guess]
        sol = wordlist.words[sol]
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

    
    
    function getNewInds(inds, width, pattern, limits) {
        if (width == 'Full') { inds = c_search(inds, pattern, limits) }            
        else if (width == 'Partial') { inds = c_search(inds, pattern) } 
        else { inds = [...inds] }
        return inds
    }
    
    
    function scoreGuess(guess, sol, pattern, limits, inds, ans) {
        if (guess == sol) { return 1 }
        [pattern, limits] = newCriteria(guess, sol, pattern, limits)
        ans = c_search(ans, pattern, limits)
        if (ans.length == 1) { return 2 }
    }
    
    
    
//     function getScore(ind, ans_inds, pattern, limits, width, inds) {
//         if (ans_inds.legnth == 0) { throw 'Ran out of solutions' }
//         if (ans_inds.length == 1) { return 1 }
//         if (ans_inds.length == 2) { return 1.5 }
//         let score = 0
//         for (const i of ans_inds) {
//             const [n_pattern,n_limits] = newCriteria(wordlist.words[ind], wordlist.words[i], pattern, limits)
//             const n_ans_inds = c_search(ans_inds, pattern, limits)
             
                
//         }
//     }
    

    
//     function getScores(ans_inds, pattern, limits, width, inds) {
//         if (width == 'Full') { inds = c_search(inds, pattern, limits) }            
//         else if (width == 'Partial') { inds = c_search(inds, pattern) } 
//         else { inds = [...inds] }
        
//         let scores = []
//         for (const i of inds) {
//             let score = 0
//             for (const j of ans_inds) {
//                 const [n_pattern,n_limits] = newCriteria(wordlist.words[i], wordlist.words[j], pattern, limits)
//                 const n_ans_inds = c_search(ans_inds, pattern, limits)
//                 if (n_ans_inds.length == 1) { score += 1 }   
//                 else {
//                     getScores(ans_inds, 
                    
//                 }
//             }
 
            
            
            
            
//         }
        
        
//     }
    
    function sortByCol(arrays, ind, reverse=False) {
        let inds = [...arrays[0].keys()]
        if (reverse) { inds.sort((a,b) => arrays[ind][a] < arrays[ind][b] ? -1 : 1) }
        else { inds.sort((a,b) => arrays[ind][a] > arrays[ind][b] ? -1 : 1) }
        for (let a=0; a<arrays.length; a++) { arrays[a] = inds.map(i=>arrays[a][i]) }
        return arrays
    }
 
    
    function shallowScore(guess, ans_inds, pattern, limits) {
        let score = 0
        for (const sol of ans_inds) {
            if (guess == sol) { score += 1 }
            else {
                const [n_pattern, n_limits] = newCriteria(guess, sol, pattern, limits)
                const ans = c_search(ans_inds, n_pattern, n_limits) 
                score += ans.length + 1
            }
        }
        return score / ans_inds.length        
    }

    
    // search function
    function searchle() {
        let [pattern, limits] = getCriteria()
        let inds = []
        const sort = getOption(['sort', 'order'])
        if (sort == 'Score') {
            pattern = cleanPattern(pattern)
            const width = getOption(['sort', 'score', 'wide'])

            let ans_inds = c_search(getInds(getOption(['sort', 'score', 'list'])), pattern, limits)     
            inds = getNewInds(getInds(), width, pattern, limits) {
            
            let score = inds.map(i=>shallowScore(i, ans_inds, pattern, limits))
           
            [inds,score] = sortByCol([inds,score],1)
            
            
            
//             const width = getOption(['sort', 'score', 'wide'])
//             if (width == 'Full') {
//                 inds = c_search(getInds(''), pattern, limits)            
//             } else if (width == 'Partial') {
//                 inds = c_search(getInds(''), pattern)    
//             } else if (width == 'None') {
//                 inds = getInds('')
//             } else { throw `Unknown sort match option ${width}` }
//             let scores = getScores(ans_inds,inds,pattern,limits)
            
            
        } else {
            inds = search(getInds(), pattern, limits)
            if (sort == 'Alphabetical') {
                inds.sort((a, b) => (wordlist.words[a]<=wordlist.words[b]) ? -1 : 1 )
            }
        }

        let ans = inds.map(i=>[wordlist.words[i]])
        if (getOption(['sort','show'])) {
            let max = wordlist.lists['Exquisite Corpus'][wordlist.lists['Exquisite Corpus'].length-1]
            max = parseInt(1/wordlist.freq[max]) + 1
            for (let i=0; i<inds.length; i++) {
                const f = wordlist.freq[inds[i]]
                if (f>0) { ans[i].push(`1 / ${Math.round(1/f)}`) }
                else { ans[i].push(`1 / ${max}+`) }
            }
        }
        ans = ans.map(info=>info.join('   -   ')).join('\n')
        document.getElementById('searchleResult').innerHTML = ans
        activeTab('Results')
    } 
    
    function hitKey(e) {
        if (e.keyCode == 13) { searchle() }
    }
    
    function activeTab(name) {
        for (let e of document.getElementsByClassName('box')) { e.style.display = 'none' }
        for (let e of document.getElementsByClassName('tabBtn')) { e.className = e.className.replace(' active','') }
        document.getElementById('box'+name).style.display = 'block';
        for (let e of document.getElementsByClassName('tabBtn')) { if (e.innerHTML == name) { e.className += ' active' } }
    }
    
    function tabClick(event) {
        const name = event.srcElement.innerHTML
        activeTab(name)
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
    
    function setCookie(key,val,days=30) {
        const d = new Date()
        d.setTime(d.getTime() + (days*24*60*60*1000))
        document.cookie = key + '=' + JSON.stringify(val) + '; expires=' + d.toUTCString()  
    }
    
    function setCookies(cookies,days=30) {
        for (const [key,val] of Object.entries(cookies)) {
            setCookie(key,val,days)
        }
    }
    
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
            
    function changeOption(keys,val) {
        let opt = options
        for (let i=0; i<keys.length-1; i++) { opt = opt[keys[i]].subops }
        opt[keys[keys.length-1]].value = val
        setCookie('options',options)
    }
    
    function getOption(keys) {
        let opt = options
        for (let i=0; i<keys.length-1; i++) { opt = opt[keys[i]].subops }
        return opt[keys[keys.length-1]].value
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
                        const E = document.createElement('option', {value:val})
                        E.appendChild(document.createTextNode(val))
                        element.appendChild(E) 
                    }
                    element.value = option.value
                    element.onchange = (e) => changeOption(keys, e.srcElement.value)  
                } else { console.log(`Unknown option of type ${option.type}`) }
            } else {
                if (typeof option.value === 'boolean') {
                    element = document.createElement('input', {id: id})
                    element.type = 'checkbox'
                    element.checked = option.value 
                    element.onchange = (e) => changeOption(keys, e.srcElement.checked)
                } else if (typeof option.value === 'string') {
                    element = document.createElement('input', {id: id})
                    element.type = 'text'
                    element.value = option.value 
                    element.onchange = (e) => changeOption(keys, e.srcElement.value) 
                } else if (typeof option.value === 'number') {
                    element = document.createElement('input', {id: id})
                    element.type = 'number'
                    element.value = option.value
                    element.onchange = (e) => changeOption(keys, e.srcElement.value)  
                } else { console.log(`Unknown option of value ${option.value}`) }
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
        parent.appendChild(frame)
    }
    
    function createOptions(options, keys=null, parent=null) {
        if (keys === null) { keys = [] }
        if (parent === null) { parent = document.getElementById('boxOptions') }
        for (const [key,option] of Object.entries(options)) {
            createOption(option, keys.concat(key), parent)
        }
    }
    
    // get data
    let wordlist = await fetch(wordlistUrl).then(response => response.json())
    let helptext = await fetch(helptextUrl).then(response => response.text())
    let cookies = getCookies()
    
    // add info
    document.getElementById('boxInfo').innerHTML = helptext.replaceAll('\n','<br>')

    // add list options options 
    for (const list in wordlist['lists']) {
        if (!(list in options.lists.subops)) {
            options.lists.subops[list] = {value: 'Include', type:['Require', 'Include', 'Nothing', 'Avoid'], pos: 'left'} 
            options.sort.subops.score.subops.list.type.push(list)
        }
    }
    options.lists.subops['Frequency'] = { value: 'f > 0' }
    
    if ('options' in cookies) { applyOptions(options,cookies.options) }
    setCookie('options',options)
    createOptions(options)

    // attach button events
    document.getElementById('searchleBtn').onclick = searchle  
    for (const e of document.getElementsByClassName('tabBtn')) { e.onclick = tabClick }
    for (const e of document.getElementsByClassName('searchInp')) { e.addEventListener('keyup', hitKey) }
    
    activeTab('Info')
    console.log(`Loaded Serachle ${version}`)
    
}
