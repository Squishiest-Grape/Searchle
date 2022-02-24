async function searchleMain(document) {
    
	// replacement helper function
	function replace(str,old_chars,new_cha) {
		for (const c of old_chars) { str = str.replaceAll(c,new_cha) }
		return str
	}
	
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
	    
    	try {
		// get html values
		let pattern = document.getElementById("SearchlePattern").value
		let requires = document.getElementById("SearchleRequires").value
		let avoids = document.getElementById("SearchleAvoids").value
		let allows = document.getElementById("SearchleAllows").value
		let result = document.getElementById("SearchleResult")

		let limits = {}


		allows = parse(allows.toLowerCase())
		for (let i=0; i<allows.length; i++) {
			let [num,val,inv] = allows[i]
			if (Array.isArray(val)) { throw 'Groupings not implimented in allows' }
			if (inv) { throw 'Inverse not implimented in allows' }
			if (val == null) { throw 'Wildcards not implimented in allows' }
			if (num == null) { num = [0,NaN] }
			else if (!Array.isArray(num)) { num = [0,num] }
			limits[val] = num
		}
		if (allows.length != 0) {
			for (const c of 'abcdefghijklmnopqrstuvwxyz') {
				if (!(c in limits)) { limits[c] = [0,0] }
			}

		}

		avoids = parse(avoids.toLowerCase())
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

		requires = parse(requires.toLowerCase())
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
		
		console.log(wordlist)
		
		pattern = parse(pattern)
		pattern = pattern2regex(pattern)
		
		// solve  
		let re = new RegExp('^'+pattern+'$','i')

		let ans = []
		for (const word in wordlist) {
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

		// order by popularity
		ans.sort((a,b)=>wordlist[b]-wordlist[a])

		// set result
		result.innerHTML = ans.join(' ')
		
	} catch (error) {
		result.innerHTML = error		
	}
		
        
    } 
    
    console.log('starting searchle')
	
    // get wordlist
    const url = 'https://raw.githubusercontent.com/Squishiest-Grape/Searchle/200c010c0324e6d158650a59d67418f75c3b0820/wordlist.json';
    let wordlist = await fetch(url).then(response => response.json())
    wordlist = wordlist['words']
    
    // attach listeners
    document.getElementById("SearchleButton").onclick = searchle

}
