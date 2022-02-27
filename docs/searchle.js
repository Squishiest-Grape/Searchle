const version = 'v0.1.4'

const wordlistUrl = 'https://raw.githubusercontent.com/Squishiest-Grape/Searchle/main/data/wordlist.json'
const helptextUrl = 'https://raw.githubusercontent.com/Squishiest-Grape/Searchle/main/docs/help.txt'

let options = {
    lists: {
        label: 'Word Lists',
        subops: {
            'Frequency Req:': { value: '' },
            'Proper Nouns': {
                value: 'Avoid',
                type: ['Require', 'Include', 'Nothing', 'Avoid'],  
            },
        }
    },
    sort: {
        label: 'Sorting Options',
        subops: {
            order: {
                label: 'Order',    
                value: 'Frequency',
                type: ['Frequency','Alphabetically','Power','Wordle Score'],
                subops: {
                    wordle: {
                        label: 'Wordle Sort Options',
                        subops: {
                            mode: {
                                label: 'Mode',
                                value: 'Super Hard Mode',
                                type: ['Normal','Hard','Super Hard'],
                            },
                            useAns: {
                                label: 'Use Wordle Answers',    
                                value: false,  
                            },
                        },
                    },
                },
            },
            show: {
                label: 'Show Value',
                value: false,
            },
        },
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
    function pattern2regex(pattern) {
        let ans = ''
        for (let [num,val,inv] of pattern) {
            if (Array.isArray(val)) {
                ans += '['
                if (inv) { ans += '^' }
                ans += val.map(v=>pattern2regex([v])).join('|')
                ans += ']'        
            } else {
                if (val == null) { val = '.' }
                if (inv) { ans += '[^' + val + ']' }
                else { ans += val }                
            }
            if (num != null) {
                if (Array.isArray(num)) {
                    if (num[1] == NaN) {
                        ans += '{'+String(num[0])+',}'
                    } else {
                        ans += '{'+String(num[0])+','+String(num[1])+'}'
                    }                    
                } else {
                    ans += '{'+String(num)+'}'
                }
            }
        }
        return ans
    }
    
    // search function
    function searchle() {
        
        let ans = ''
        
        try {
            // get html values
            let pattern = document.getElementById('searchlePattern').value
            let requires = document.getElementById('searchleRequires').value
            let avoids = document.getElementById('searchleAvoids').value

            // get limits
            let limits = {}

            avoids = parse(avoids)
            for (let i=0; i<avoids.length; i++) {
                let [num,val,inv] = avoids[i]
                if (Array.isArray(val)) { throw 'Groupings not implimented in avoids' }
                if (inv) { throw 'Inverse not implimented in avoids' }
                if (val == null) { throw 'Wildcards not implimented in avoids' }
                if (num == null) { num = [0,0] }
                else if (Array.isArray(num)) {
                    if (num[1] != NaN) { throw 'Multi-range not implimented' }
                    num = [0,num[0]]
                }
                else { num = [0,num] }
                if (val in limits) {
                    if (limits[val][0] > num[0]) { num[0] = limits[val][0] }
                    if ((num[1] == NaN) || (limits[val][1] < num[1])) { num[1] = limits[val][1] } 
                }
                limits[val] = num
            }

            requires = parse(requires)
            for (let i=0; i<requires.length; i++) {
                let [num,val,inv] = requires[i]
                if (Array.isArray(val)) { throw 'Groupings not implimented in requires' }
                if (inv) { throw 'Inverse not implimented in requires' }
                if (val == null) { throw 'Wildcards not implimented in requires' }
                if (num == null) { num = 1 }
                if (Array.isArray(num)) {
                    limits[val] = num
                } else {
                    if (val in limits) { limits[val] = [limits[val][0]+num,limits[val][1]+num] }
                    else { limits[val] = [num,NaN] }
                }
            }

            pattern = parse(pattern)
            pattern = pattern2regex(pattern)

            // solve  
            let re = new RegExp('^'+pattern+'$','i')

            ans = []
            for (const word of wordlist['words']) {
                if (re.test(word)) {
                let good = true
                for (const part in limits) {
                    let c = (word.match(new RegExp(part,'gi')) || []).length
                    if (c < limits[part][0] || c > limits[part][1]) {
                        good = false
                        break
                    }
                }
                if (good) { ans.push(word) } 
                }
            }
            ans  = ans.join('\n')
        } catch (error) {
            ans = error       
        }
        document.getElementById('searchleResult').innerHTML = ans
        activeTab('Results')
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
    
    function createOption(option, keys, parent) {
        const frame = document.createElement('div')
        const id = keys.join('.')
        let label = keys[keys.length-1]
        if ('label' in option) { label = option.label }
        if ('value' in option) {
            let subframe = document.createElement('div') 
            subframe.style.float = 'left'
            if ('type' in option) {
                if (Array.isArray(option.type)) {
                    const element = document.createElement('select', {id: id, value:option.value})
                    for (const val of option.type) {
                        if (val == option.value) {
                        const e = document.createElement('option', {value:val})
                        e.appendChild(document.createTextNode(val))
                        element.appendChild(e) 
                    }
                    element.onchange = (e) => changeOption(keys, e.srcElement.value)  
                    subframe.appendChild(element)
                    subframe.appendChild(document.createTextNode(' '+label))
                } else { console.log(`Unknown option of type ${option.type}`) }
            } else {
                if (typeof option.value === 'boolean') {
                    const element = document.createElement('input', {type:'checkbox', id: id, checked: option.value})
                    element.onchange = (e) => changeOption(keys, e.srcElement.checked)  
                    subframe.appendChild(element)
                    subframe.appendChild(document.createTextNode(' '+label))
                } else if (typeof option.value === 'string') {
                    const element = document.createElement('input', {type:'text', id: id, value: option.value})
                    element.onchange = (e) => changeOption(keys, e.srcElement.value)  
                    subframe.appendChild(document.createTextNode(label+' '))
                    subframe.appendChild(element)
                } else if (typeof option.value === 'number') {
                    const element = document.createElement('input', {type:'number', id: id, value: option.value})
                    element.onchange = (e) => changeOption(keys, e.srcElement.value)  
                    subframe.appendChild(document.createTextNode(label+' '))
                    subframe.appendChild(element)
                } else { console.log(`Unknown option of value ${option.value}`) }
            }
            frame.appendChild(subframe)
        } else {
            frame.appendChild(document.createTextNode(label))
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
            options.lists.subops[list] = {value: 'Include', type:['Require', 'Include', 'Nothing', 'Avoid']}
        }
    }
    
    if ('options' in cookies) { applyOptions(options,cookies.options) }
    setCookie('options',options)
    createOptions(options)

    // attach button events
    document.getElementById('searchleBtn').onclick = searchle
    const tabs = document.getElementsByClassName('tabBtn')
    for (const e of tabs) { e.onclick = tabClick }
    
    activeTab('Info')
    console.log(`Loaded Serachle ${version}`)
    
}
