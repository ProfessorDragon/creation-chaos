var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
var canvaswrapper = document.getElementById("wrapper");
//const socket = io();

var frame = 0, fps = 0, fpsdrop = null;
var refreshtimestamp; // timestamp of the last time update_fps was called, used for calculating fps
var mousex, mousey, dragx, dragy;
var lmdown = 0, rmdown = 0, mmdown = 0; // how many frames each mouse button has been held, -1 = released last frame
var reqrelease = false; // if the left mouse button needs to be released before placing any other blocks
var keys = [], dirkeys = {left: false, right: false, up: false, down: false, jump: false, run: false, interact: 0}; // pressed keys
var audiochannels = {}, loadedaudio = false; // audio data
var scrollx = 0, scrolly = 0; // scroll offset of camera

var placemode = 0; // tool being used (1 = eraser, 2 = multiselect, etc.)
var menu = {}; // current menu being viewed
var hotbaritems = [
	{id: "start", type: 0}, {id: "ground", type: 0}, {id: "brick", type: 0}, {id: "question", type: 0},
	{id: "ice", type: 0}, {id: "bridge", type: 0}, {id: "coin", type: 1}, {id: "mushroom", type: 1},
	{id: "foppy", type: 1}, {id: "blockhead", type: 1}, {id: "muncher", type: 1}, {id: "onewayright", type: 0}
	];
var prefs = null; // user preferences, not stored in level
var levelsettings = {displayname: "", playerent: {id: "player", type: 1, conf: {}}, playerlives: 0, timer: 0, dynamicjoin: false,
	startarea: 0, warps: []};
var areasettings = {areaname: "Main", areah: 42, theme: 0, spawnlines: null};
var blocks = []; // table of block ids
var entities = []; // array of entity info
var curtile = {...hotbaritems[0], hotbarslot: 0};
var selectionrect = null, selectedtiles = []; // for multiselect

var ptblocks = []; // block array used in playtesting with info such as block contents
var ptentities = []; // entity array used in playtesting with entities represented as classes
var ptparticles = []; // particle array used in playtesting with individual particles represented as classes
var ptvars = {}; // vars used in playtest
var globaliter = 0, collisioniter = 0; // playtest global iterator variables

function ping(){
    before = new Date();
    socket.emit("ping", null, function(resp){
        alert((new Date()-before)+"ms");
    });
}

function compress_copy(obj){
	if (navigator.clipboard == null) return false;
	navigator.clipboard.writeText(LZString.compressToUTF16(JSON.stringify(obj)));
	return true;
}

function compress_download(fn, obj){
	data = LZString.compressToUTF16(JSON.stringify(obj));
    el = document.createElement("a");
    el.setAttribute("href", "data:text/plain;charset=utf-8,"+encodeURIComponent(data));
    el.setAttribute("download", fn);
    el.style.display = "none";
    document.body.appendChild(el);
    el.click();
    document.body.removeChild(el);
}

function decompress_object(text){
	data = LZString.decompressFromUTF16(text);
	if (data == null){
		alert("There was an error decrypting the data. It may be corrupt.");
		return;
	}
	try {
		data = JSON.parse(data);
	} catch (e){
		alert("There was an error parsing the data. It may be corrupt.");
		return;
	}
	return data;
}

function save(download=false){
	leveldata = save_session();
	if (download){
		fn = levelsettings.displayname;
		if (fn == null || fn == "") fn = "level";
		fn += ".cch";
		compress_download(fn, leveldata);
	} else if (compress_copy(leveldata)){
		alert("Successfully copied level data to the clipboard.");
	} else {
		alert("Permission to access the clipboard has been denied. Please change your settings in order to save the level.");
	}
}

function load(text){
	data = decompress_object(text);
	if (data == null) return true;
	if (data.constructor != Object) return false;
	save_session("load", data);
	return true;
}

function load_from_clipboard(){
	navigator.clipboard.readText().then(function(text){
		if (!load(text)){
			alert("The clipboard does not contain level data.");
		}
	}).catch(function(e){
		alert("Permission to access the clipboard has been denied. Please change your settings in order to load the level data.");
	});
}

function load_from_file(){
	el = document.createElement("input");
    el.type = "file";
    el.onchange = function(){
		file = el.files[0];
		if (!file) return;
		reader = new FileReader();
		reader.readAsText(file, "utf-8");
		reader.onload = function(e){load(e.target.result)}
	}
    el.click();
}

function save_session(action, set){
	leveldata = {...levelsettings};
	areadata = {...areasettings};
	areadata.blocks = blocks, areadata.entities = entities;
	for (ent of entities){
		contents = ent;
		while (contents != null){
			increment_area_counter(entitydata[contents.id]);
			contents = get_config(contents, "contents");
			if (contents != null && contents.type != 1) break;
		}
	}
	old = JSON.parse(sessionStorage.getItem("level"));
	if (old == null || action == "clear"){
		leveldata.areas = [{...areadata}];
	} else {
		old.areas[prefs.area] = {...areadata};
		newarea = false;
		if (action == "new"){
			if (old.areas.length == 1) name = "Subarea";
			else name = "Area "+(old.areas.length+1);
			areasettings = {areaname: name, areah: 42, theme: 0, spawnlines: null, blocks: [], entities: []};
			old.areas.push(areasettings);
			prefs.area = old.areas.length-1;
			newarea = true;
		} else if (action == "delete"){
			if (old.areas.length > 1){
				if (levelsettings.startarea == prefs.area) levelsettings.startarea = 0;
				else if (levelsettings.startarea > prefs.area) levelsettings.startarea--;
				old.areas.splice(prefs.area, 1);
				prefs.area = Math.max(prefs.area-1, 0);
				areasettings = {...old.areas[prefs.area]};
				newarea = true;
			}
		} else if (action == "change"){
			areasettings = {...old.areas[set]};
			prefs.area = set;
			newarea = true;
		} else if (action == "setstart"){
			b = old.areas[levelsettings.startarea].blocks;
			for (x = 0; x < b.length; x++){
				for (y = 0; y < b[x].length; y++){
					if (b[x][y] == "start"){
						b[x][y] = null;
						break;
					}
				}
			}
			old.areas[levelsettings.startarea].blocks = b;
			levelsettings.startarea = leveldata.startarea = prefs.area;
		} else if (action == "load"){
			leveldata = set;
			levelsettings = {...levelsettings, ...leveldata};
			delete levelsettings.areas;
			levelsettings.displayname ??= "";
			levelsettings.playerent ??= {id: "player", type: 1, conf: {}};
			levelsettings.playerlives ??= 1;
			levelsettings.startarea ??= 0;
			old.areas = [...leveldata.areas];
			areasettings = {...old.areas[0]};
			prefs.area = 0;
			newarea = true;
		}
		if (newarea){
			blocks = areasettings.blocks, entities = areasettings.entities;
			scroll_to_region(0);
			scroll_to_region(3);
			delete areasettings.blocks;
			delete areasettings.entities;
			delete areasettings.keycoins;
		}
		leveldata.areas = old.areas;
	}
	sessionStorage.setItem("level", JSON.stringify(leveldata));
	return leveldata;
}

function save_preferences(){
	prefsdata = {};
	for (k of Object.keys(prefs)){
		if (["area", "framebyframe"].includes(k)) continue;
		prefsdata[k] = prefs[k];
	}
	localStorage.setItem("prefs", JSON.stringify(prefsdata));
	return prefsdata;
}

function load_preferences(){
	prefsdata = JSON.parse(localStorage.getItem("prefs"));
	if (prefsdata == null) return;
	prefs = {...prefs, ...prefsdata};
	return prefsdata;
}

function in_fullscreen_menu(){
	if (menu.id == "tiles") return true;
	if (menu.id == "entity" && menu.subpage == "widget") return true;
	return false;
}

function in_placing_mode(...accept){
	if (placemode == 0 || placemode == 3) return true;
	return accept.includes(placemode);
}

function mouse_move(e){
	if (e == null){
		mousex = null;
		mousey = null;
	} else {
		r = e.target.getBoundingClientRect();
		mousex = (e.clientX - r.left)/r.width*maxw;
		mousey = (e.clientY - r.top)/r.height*maxh;
		if (e.which == 0){ // mouse up
			if (lmdown > 0) lmdown = -1;
			if (rmdown > 0) rmdown = -1;
			if (mmdown > 0) mmdown = -1;
			dragx = null, dragy = null;
		} else if ((mmdown > 0 || (lmdown > 0 && placemode == 0 && curtile == null)) &&
				!in_fullscreen_menu() && dragx != null && !ptvars.playing){ // middle button panning
			m = shift_pressed()+1;
			scrollx += (mousex-dragx)*m;
			scrolly += (mousey-dragy)*m;
			clamp_scroll();
		}
		if (e.which > 0) dragx = mousex, dragy = mousey;
	}
}

function mouse_down(e){
	load_sounds();
	if (e.which == 1) lmdown = 1;
	else if (e.which == 3) rmdown = 1;
	else if (e.which == 2) mmdown = 1;
	e.preventDefault();
}

function mouse_up(e){
	if (e.which == 1) lmdown = -1;
	else if (e.which == 3) rmdown = -1;
	else if (e.which == 2) mmdown = -1;
}

function load_sounds(){
	if (loadedaudio) return;
	for (fn of Object.keys(audiodata)){
		d = audiodata[fn];
		a = new Audio("sounds/"+((d.copy !== undefined)?d.copy:fn)+".wav");
		a.volume = 0;
		a.play();
		audiochannels[fn] = a;
	}
	loadedaudio = true;
}

function play_sound(name){
	if (!loadedaudio || !(name in audiochannels)) return;
	channel = audiochannels[name];
	channel.currentTime = 0, channel.loop = dict_get(channel, "loop", false);
	channel.volume = (dict_get(channel, "music", false)?prefs.musicvolume:prefs.sfxvolume)/100;
	channel.play();
}

function clear_placemode(){
	placemode = 0;
	selectionrect = null, selectedtiles = [];
}

function check_curtile_in_hotbar(add=false){
	for (h of hotbaritems){
		if (h.type == curtile.type && (h.originalid || h.id) == curtile.id){
			curtile.hotbarslot = h.hotbarslot;
			return;
		}
	}
	if (add) hotbaritems.unshift({...curtile});
}

function scroll_to_region(r){
	if (r == 0) scrollx = 0;
	else if (r == 1) scrollx = Math.min(0, -blocks.length*tilew+maxw);
	else if (r == 2) scrolly = 0;
	else if (r == 3) scrolly = -tilew*areasettings.areah+maxh;
}

function zoom(level){
	prefs.zoom = level;
	canvas.width = maxw = 1600*level;
	canvas.height = maxh = 900*level;
}

function increment_area_counter(d){
	if (d.class == KeyCoin){
		areadata.keycoins ??= {};
		areadata.keycoins[get_config(d, "group")-1] ??= 0;
		areadata.keycoins[get_config(d, "group")-1]++;
	} else if (d.class == LargeCollectable && get_config(d, "type") == -1){
		areadata.starcoins ??= 0;
		areadata.starcoins++;
	}
}

function text_input_keyevent(text, e){
	close = false;
	if (e.key == "Enter"){
		if (e.ctrlKey) close = true;
		else text += "\n";
	} else if (e.key == "Backspace"){
		if (e.ctrlKey){
			text = text.split("\n").flatMap(el => [el, "\n"]).slice(0, -1)
			if (text[text.length-1] == "") text = text.slice(0, -1);
			text = text.slice(0, -1).join("");
		} else text = text.slice(0, -1);
	} else if (e.which > 0 && !e.ctrlKey && !e.metaKey && !e.altKey && e.which != 8 && e.key.length == 1){
		text += e.key;
	}
	return {text: text, close: close};
}

function set_dirkeys(){
	dirkeys.left = keys.includes("ArrowLeft") || keys.includes("KeyA");
	dirkeys.right = keys.includes("ArrowRight") || keys.includes("KeyD");
	dirkeys.up = keys.includes("ArrowUp") || keys.includes("KeyW");
	dirkeys.down = keys.includes("ArrowDown") || keys.includes("KeyS");
	if (dirkeys.left && dirkeys.right){
		dirkeys.left = false, dirkeys.right = false;
	}
	dirkeys.jump = keys.includes("Space") || keys.includes("KeyK") || keys.includes("KeyX") || (dirkeys.up && prefs.tapjump);
	dirkeys.run = keys.includes("KeyL") || keys.includes("KeyZ") || shift_pressed();
}

function handle_editor_keypresses(e){
	if (menu.subpage == "widget"){
		if (e.code == "Escape"){
			close_menu_widget();
			return;
		}
		if (menu.widget.type == "text"){
			ent = menu.page;
			if (typeof ent == "number") ent = entities[ent];
			if (menu.contentsdir != null){
				for (i = 0; i < menu.contentsdir.length; i++){
					ent = get_config(ent, menu.contentsdir[i]);
				}
			}
			text = text_input_keyevent(get_config(ent, menu.widget.field), e);
			close = text.close, text = text.text;
			sp = text.split("\n");
			if (menu.widget.linelimit != null && sp.length > menu.widget.linelimit){
				text = sp.slice(0, -1).join("\n");
				if (menu.widget.linelimit == 1) close = true;
			}
			set_config(ent, menu.widget.field, text);
			if (close) close_menu_widget();
		} else if (menu.widget.type == "select"){
			if (e.code == "ArrowUp") menu.widget.scroll--;
			else if (e.code == "ArrowDown") menu.widget.scroll++;
			else if (e.code == "PageUp") menu.widget.scroll -= 6;
			else if (e.code == "PageDown") menu.widget.scroll += 6;
		}
	} else if (!in_fullscreen_menu()){
		if (keys.includes("ControlLeft")){
			if (e.code == "KeyS"){
				click_save_clipboard_button();
				return false;
			} else if (e.code == "KeyO"){
				click_load_clipboard_button();
				return false;
			} else if (e.code == "KeyV"){
				click_multiselect_paste_button();
				return false;
			}
		}
		if (e.code == "Escape"){
			if (menu.id != null){
				set_menu();
				if (placemode == -1) clear_placemode();
			} else curtile = null;
		} else if (e.code == "Tab"){
			if (shift_pressed()){
				toggle_menu("settings", true);
				set_menu("settings", prefs, "widget");
				menu.widget = {type: "select", field: "area", name: "Current subarea", linelimit: 11, optionsfunc: get_subarea_names,
					prev: prefs.area, scroll: 0, shift: true, useindex: true, hidenone: true};
			} else cycle_menus();
		} else if (e.code == "KeyE") click_erase_button();
		else if (e.code == "KeyQ") click_multiselect_button();
		else if (e.code == "KeyB") click_fillbucket_button();
		else if (e.code == "KeyT") click_hotbar_slot();
		else if (e.code == "KeyP") click_play_button();
		else if (e.code == "Home") scroll_to_region(0);
		else if (e.code == "End") scroll_to_region(1);
		else if (e.code == "PageUp") scroll_to_region(2);
		else if (e.code == "PageDown") scroll_to_region(3);
		if (selectedtiles.length > 0 && placemode == 2) return handle_multiselect_keypresses(e);
		if (selectedtiles.length > 0 && placemode == 4) return handle_multiselect_paste_keypresses(e);
		if (menu.id == "entity") return handle_entitymenu_keypresses(e);
		if (e.code == "KeyA") change_curtile_variant(false);
		else if (e.code == "KeyD") change_curtile_variant(true);
		else if (e.code == "KeyW") change_hotbar_slot(false);
		else if (e.code == "KeyS") change_hotbar_slot(true);
	} else if (menu.id == "tiles"){
		if (e.code == "Escape"){
			if (menu.subpage != null && !menu.noback) menu.subpage = null;
			else click_hotbar_slot();
		} else if (e.code == "KeyT") click_hotbar_slot();
	}
}

function handle_entitymenu_keypresses(e){
	ent = entities[menu.page];
	m = .5+e.shiftKey*1.5;
	xofs = 0, yofs = 0;
	if (e.code == "Delete" || e.code == "Backspace"){
		shift_editor_entity(menu.page, "delete");
		set_menu();
		clear_placemode();
	} else if (e.code == "Escape" || e.code == "Enter"){
		set_menu();
		clear_placemode();
	} else if (e.code == "ArrowLeft") xofs -= m;
	else if (e.code == "ArrowRight") xofs += m;
	else if (e.code == "ArrowUp") yofs -= m;
	else if (e.code == "ArrowDown") yofs += m;
	else if (e.code == "BracketLeft"){
		if (e.ctrlKey || e.shiftKey) menu.page = change_layer(menu.page, 0, true);
		else menu.page = change_layer(menu.page, -1);
	} else if (e.code == "BracketRight"){
		if (e.ctrlKey || e.shiftKey) menu.page = change_layer(menu.page, -1, true);
		else menu.page = change_layer(menu.page, 1);
	} else if (e.code == "KeyD"){
		m = .5*!shift_pressed();
		set_tile(ent.x+m, ent.y+m, {...ent, type: 1});
		menu.page = entities.length-1;
	}
	if (xofs != 0 || yofs != 0){
		ent.x = Math.max(ent.x+xofs, -.5);
		ent.y = Math.max(Math.min(ent.y+yofs, areasettings.areah-.5), -.5);
		shift_editor_entity(menu.page, "move");
	}
}

function handle_multiselect_keypresses(e){
	if (keys.includes("ControlLeft")){
		if (e.code == "KeyC"){
			click_multiselect_copy_button();
			return false;
		}
		if (e.code == "KeyX"){
			click_multiselect_copy_button();
			delete_selected_tiles();
			return false;
		}
	}
	m = 1+e.shiftKey*2;
	xofs = 0, yofs = 0;
	if (e.code == "Delete" || e.code == "Backspace") delete_selected_tiles();
	else if (e.code == "Escape" || e.code == "Enter") selectedtiles = [];
	else if (e.code == "KeyA") xofs -= m;
	else if (e.code == "KeyD") xofs += m;
	else if (e.code == "KeyW") yofs -= m;
	else if (e.code == "KeyS") yofs += m;
	if (xofs != 0 || yofs != 0){
		sort_selected_tiles("offset", xofs, yofs);
		for (t of selectedtiles){
			if (t.type == 0){
				set_tile(t.x+xofs, t.y+yofs, {id: get_tile(t.x, t.y, 0), type: 0});
				set_tile(t.x, t.y, {id: null, type: 0});
				t.x += xofs, t.y += yofs;
			} else if (t.type == 1){
				ent = entities[t.num];
				ent.x = Math.max(ent.x+xofs, -.5);
				ent.y = Math.max(Math.min(ent.y+yofs, areasettings.areah-.5), -.5);
				shift_editor_entity(t.num, "move");
			}
		}
	}
}

function handle_multiselect_paste_keypresses(e){
	m = 1+e.shiftKey*2;
	xofs = 0, yofs = 0;
	if (e.code == "Escape" || e.code == "Enter") clear_placemode();
	else if (e.code == "KeyA") xofs += m;
	else if (e.code == "KeyD") xofs -= m;
	else if (e.code == "KeyW") yofs += m;
	else if (e.code == "KeyS") yofs -= m;
	if (xofs != 0 || yofs != 0){
		b = get_multiselect_bounds(selectedtiles, x => x+xofs, y => y+yofs);
		if (b.minx > 0 || b.miny > 0 || b.maxx < 0 || b.maxy < 0){
			get_multiselect_bounds(selectedtiles, x => x-xofs, y => y-yofs);
		}
	}
}

function handle_playtest_keypresses(e){
	if (e.code == "KeyP") click_stop_button();
}

function key_down(e){
	if (e.key == "Alt" || e.key == "Tab") e.preventDefault(); // defocusing keys
	if (["ControlRight", "AltLeft", "AltRight", "Meta"].includes(e.code)) return;
	if (e.key.length == 1) load_sounds();
	if (!ptvars.playing){
		if (handle_editor_keypresses(e) == false){
			e.preventDefault();
			idx = keys.indexOf("ControlLeft");
			if (idx > -1) keys.splice(idx, 1);
			set_dirkeys();
			return;
		}
	} else handle_playtest_keypresses(e);
	if (prefs.framebyframe && e.code == "KeyN") update();
	if (!keys.includes(e.code)) keys.push(e.code);
	set_dirkeys();
}

function key_up(e){
	idx = keys.indexOf(e.code);
	if (idx > -1) keys.splice(idx, 1);
	set_dirkeys();
}

function scroll_wheel(e){
	if (!e.deltaY || ptvars.playing) return;
	if (menu.subpage == "widget"){
		m = e.deltaY/Math.abs(e.deltaY)*(1+shift_pressed()*2);
		menu.widget.scroll += m;
	} else if (!in_fullscreen_menu()){
		m = e.deltaY/-60*(20+shift_pressed()*20);
		if (e.ctrlKey) scrolly += m;
		else scrollx += m;
		clamp_scroll();
	}
	e.preventDefault();
}

function resize(){
    if (window.innerWidth/window.innerHeight*(9/16) > 1){
        n = window.innerHeight*(16/9);
		canvaswrapper.style.height = "", canvaswrapper.style.width = n+"px";
        n = (window.innerWidth-n)/2;
        canvaswrapper.style.marginTop = "", canvaswrapper.style.marginBottom = "";
        canvaswrapper.style.marginLeft = n+"px", canvaswrapper.style.marginRight = n+"px";
    } else {
        n = window.innerWidth*(9/16);
        canvaswrapper.style.width = "", canvaswrapper.style.height = n+"px";
		n = (window.innerHeight-n)/2;
		canvaswrapper.style.marginLeft = "", canvaswrapper.style.marginRight = "";
		canvaswrapper.style.marginTop = n+"px", canvaswrapper.style.marginBottom = n+"px";
	}
}

function open_canvas_image(can){
	if (can == null) can = canvas;
	img = document.createElement("img");
	img.src = can.toDataURL("image/png");
	img.style.objectFit = "contain";
	img.style.width = "100%", img.style.height = "100%";
	w = window.open();
	w.document.body.appendChild(img);
}

function change_layer(n, ofs, absolute=false){
	if (absolute){
		m = (entities.length+ofs)%entities.length;
		entities.splice(m, 0, entities.splice(n, 1)[0]);
	} else {
		m = n+ofs;
		if (n < 0 || n > entities.length-1 || m < 0 || m > entities.length-1) return n;
		[entities[n], entities[m]] = [entities[m], entities[n]];
	}
	return m;
}

function change_curtile_variant(next){
	if (curtile == null) return;
	if (placemode > 0 && !in_placing_mode()){
		clear_placemode();
		return;
	}
	d = get_sprite_data({...curtile}, false);
	if (d.variants == null) return;
	curtile.id = d.variants[(d.variants.indexOf(curtile.id)+d.variants.length+next*2-1)%d.variants.length];
	d2 = get_sprite_data({...curtile}, false);
	if (d2.conf != null) curtile.conf = {...d2.conf};
	hotbaritems[curtile.hotbarslot] = {...curtile};
}

function change_hotbar_slot(next){
	if (placemode > 0 && !in_placing_mode()){
		clear_placemode();
		return;
	}
	if (curtile == null || curtile.hotbarslot == null){
		curtile = {...hotbaritems[next?(hotbaritems.length-1):0]};
	} else {
		curtile = {...hotbaritems[(curtile.hotbarslot+hotbaritems.length+next*-2+1)%hotbaritems.length]};
	}
	curtile.id = curtile.originalid || curtile.id;
}

function draw_grid(){
    ctx.strokeStyle = "rgba(128, 128, 128, 0.4)";
    p = scrollx%(tilew*3);
    i = 0;
    while (p < maxw){
        ctx.lineWidth = (i%3 == 0)?1:.5;
        ctx.beginPath();
        ctx.moveTo(p, 0);
        ctx.lineTo(p, maxh);
        ctx.stroke();
        p += tilew;
        i++;
    }
    p = scrolly%(tilew*3);
    i = 0;
    while (p < maxh){
        ctx.lineWidth = (i%3 == 0)?1:.5;
        ctx.beginPath();
        ctx.moveTo(0, p);
        ctx.lineTo(maxw, p);
        ctx.stroke();
        p += tilew;
        i++;
    }
}

function count_occurences(arr, val){
	return arr.reduce((c, v) => ((v == val)?(c+1):c), 0);
}

function count_matching(arr, check){
	return arr.reduce((c, v) => (check(v)?(c+1):c), 0);
}

function get_multiselect_data(relative){
	tiles = [];
	minx = null, miny = null;
	for (t of selectedtiles){
		if (t.type == 0){
			tiles.push({id: get_tile(t.x, t.y, 0), x: t.x, y: t.y, type: 0});
			if (minx == null || t.x < minx) minx = t.x;
			if (miny == null || t.y < miny) miny = t.y;
		} else if (t.type == 1){
			ent = entities[t.num];
			tiles.push({id: ent.id, x: ent.x, y: ent.y, conf: {...ent.conf}, type: 1});
			if (minx == null || ent.x < minx) minx = ent.x;
			if (miny == null || ent.y < miny) miny = ent.y;
		}
	}
	if (relative) return tiles.map(t => ({...t, x: t.x-minx, y: t.y-miny}));
	return tiles;
}

function place_multiselect_data(tiles, xofs=0, yofs=0){
	stripped = [];
	for (t of tiles){
		if (!check_tile_limit(t, false)) continue;
		if (t.type == 0){
			set_tile(xofs+t.x, yofs+t.y, {id: t.id, type: 0});
			stripped.push({x: xofs+t.x, y: yofs+t.y, type: 0});
		} else if (t.type == 1){
			set_tile(xofs+t.x, yofs+t.y, {id: t.id, conf: {...t.conf}, type: 1});
			stripped.push({num: entities.length-1, type: 1});
		}
	}
	return stripped;
}

function get_multiselect_bounds(tiles, xfunc, yfunc){
	minx = null, miny = null;
	maxx = null, maxy = null;
	for (t of tiles){
		if (xfunc != null) t.x = xfunc(t.x);
		if (yfunc != null) t.y = yfunc(t.y);
		if (minx == null || t.x < minx) minx = t.x;
		if (miny == null || t.y < miny) miny = t.y;
		if (maxx == null || t.x > maxx) maxx = t.x;
		if (maxy == null || t.y > maxy) maxy = t.y;
	}
	return {minx: minx, miny: miny, maxx: maxx, maxy: maxy};
}

function get_surrounding_matches(id, x, y, matchleft=false, matchright=false){
	m = [];
	for (yofs = -1; yofs <= 1; yofs++){
		for (xofs = -1; xofs <= 1; xofs++){
			if ((matchleft && x+xofs < 0) || (matchright && x+xofs >= blocks.length)
				|| y+yofs < 0 || y+yofs >= blocks[x].length){
				m.push(true);
			} else {
				t = get_tile(x+xofs, y+yofs, 0);
				if (levelsettings.dynamicjoin) m.push(t == id || indexeddynamicblocks.includes(t));
				else m.push(t == id);
			}
		}
	}
	return m;
}

function get_dynamic_id(id, x, y, alt=null){
	dynamic = (blockdata[id] || {}).dynamic;
	if (dynamic == null || dynamic == 0) return id;
	newid = id+"_";
	m = get_surrounding_matches(alt || id, x, y);
	if (dynamic == 1){
		if (m[1] && m[3] && m[5] && m[7]){
			r = count_occurences(m, true);
			if (r == 5) newid += "2";
			else if (r != 8) newid = null;
			else if (!m[0]) newid += "tl3";
			else if (!m[2]) newid += "tr3";
			else if (!m[6]) newid += "bl3";
			else if (!m[8]) newid += "br3";
			else newid = null;
		} else if (m[3] && m[5] && m[7]){
			if (!m[6] && !m[8] && newid+"t3" in blockdata) newid += "t3";
			else newid += "t";
		} else if (m[1] && m[3] && m[5]){
			if (!m[0] && !m[2] && newid+"b3" in blockdata) newid += "b3";
			else newid += "b";
		} else if (m[1] && m[5] && m[7]){
			if (!m[2] && !m[8] && newid+"l3" in blockdata) newid += "l3";
			else newid += "l";
		} else if (m[1] && m[3] && m[7]){
			if (!m[0] && !m[6] && newid+"r3" in blockdata) newid += "r3";
			else newid += "r";
		} else if (m[5] && m[7] && m[8]) newid += "tl";
		else if (m[3] && m[7] && m[6]) newid += "tr";
		else if (m[1] && m[5] && m[2]) newid += "bl";
		else if (m[1] && m[3] && m[0]) newid += "br";
		else if (m[5] && m[7]) newid += "br2";
		else if (m[3] && m[7]) newid += "bl2";
		else if (m[1] && m[5]) newid += "tr2";
		else if (m[1] && m[3]) newid += "tl2";
		else if (m[1] && m[7]) newid += "tb";
		else if (m[3] && m[5]) newid += "lr";
		else if (m[7]) newid += "t2";
		else if (m[5]) newid += "l2";
		else if (m[3]) newid += "r2";
		else if (m[1]) newid += "b2";
		else newid += "tblr";
	} else if (dynamic == 2){
		if (!m[3] && m[5]) newid += "l";
		else if (m[3] && !m[5]) newid += "r";
		else if (!m[3] && !m[5]) newid += "lr";
		else newid = null;
	} else if (dynamic == 3){
		if (!m[1] && m[7]) newid += "t";
		else if (m[1] && !m[7]) newid += "b";
		else if (!m[1] && !m[7]) newid += "tb";
		else newid = null;
	}
	if (newid != null && newid in blockdata) return newid;
	return id;
}

function draw_tile(id, x, y, type, alt, flipx=false, iscur=false){
	nx = x*tilew+scrollx, ny = y*tilew+scrolly;
	if (nx > maxw || ny > maxh) return;
	if (type == 0 && alt) id = get_dynamic_id(id, x, y); // draw dynamic tile
	d = get_sprite_data({id: id, type: type}, false);
	if (d == null) d = blockdata.missing;
	else if (iscur && d.show != null){
		if (d.show.curtile != null) d = get_sprite_data({id: d.show.curtile, type: type}, false);
		else if (d.show.tile != null) d = get_sprite_data({id: d.show.tile, type: type}, false);
	}
	if (nx < -d.w || ny < -d.h) return;
	if (type == 0) s = blocksheet;
	else if (type == 1) s = entitysheet;
	nw = d.w, nh = d.h, sx = d.x, sy = d.y;
	if (iscur){
		ctx.globalAlpha = .7;
	} else if (type == 1 && alt){ // draw entity in bottom left
		nw *= .6, nh *= .6;
		nx = nx+tilew*.4, ny = ny+tilew*.4;
		div = Math.max(d.w/tilew, d.h/tilew);
		if (div != 1){
			if (d.w > d.h) ny += tilew/2-nh/div/2;
			else if (d.h > d.w) nx += tilew/2-nw/div/2;
			nw /= div, nh /= div;
		}
	} else if (d.frames != null && d.frames > 1 && d.loop){ // animated texture
		f = Math.floor(frame/(d.framespeed || 4))%d.frames; // calculate the current frame of the animation
		sx += d.w*f; // shift the cropped region of the source image over by the current frame * the width of one frame
	}
	if (flipx){
		ctx.save();
		ctx.scale(-1, 1);
		ctx.drawImage(s, sx, sy, d.w, d.h, -nx, ny, -nw, nh);
		ctx.restore();
	} else ctx.drawImage(s, sx, sy, d.w, d.h, nx, ny, nw, nh);
	ctx.globalAlpha = 1;
	return [nx, ny, nw, nh];
}

function set_tile(x, y, t, stop=true){
	if (x < -.5 || y < -.5 || y > areasettings.areah-.5) return false;
	if (t.id == null){
		if (t.type == 0){
			if (blocks.length <= x || blocks[x][y] == null) return false;
			if (blocks[x][y] == null) return false;
			blocks[x][y] = null;
			while (blocks.length > 0 && blocks[blocks.length-1].every(el => el == null)){
				blocks.pop();
			}
		} else if (t.type == 1){
			n = get_tile(x, y, 1, stop);
			if (n == null) return false;
			if (stop) shift_editor_entity(n, "delete");
			else {
				for (i = 0; i < n.length; i++) shift_editor_entity(n[i], "delete");
			}
		}
	} else if (t.type == 0){
		while (blocks.length <= x){
			blocks.push(Array(areasettings.areah).fill(null));
		}
		if (blocks[x][y] == t.id) return false;
		blocks[x][y] = t.id;
		if (t.id == "start" && levelsettings.startarea != prefs.area) save_session("setstart");
	} else if (t.type == 1){
		d = entitydata[t.id];
		ent = {id: t.id, x: x, y: y, conf: {}};
		if (d.conf != null) ent.conf = {...d.conf};
		if (t.conf != null) ent.conf = {...ent.conf, ...t.conf};
		entities.push(ent);
		shift_editor_entity(entities.length-1, "place");
	}
	return true;
}

function get_tile(x, y, type, stop=true){
	if (type == 0){
		if (x%1 != 0 || y%1 != 0) return;
		if (x < 0 || x >= blocks.length || y < 0 || y >= blocks[x].length) return;
		return blocks[x][y];
	} else if (type == 1){
		ents = [];
		for (i = entities.length-1; i >= 0; i--){
			if (entities[i].x == x && entities[i].y == y){
				if (stop) return i;
				ents.push(i);
			}
		}
		if (ents.length > 0) return ents;
	}
}

function get_playtest_tile(x, y, type){
	if (type == 0){
		if (x%1 != 0 || y%1 != 0) return {id: null, bumped: 0};
		if (x < 0 || x >= ptblocks.length || y < 0 || y >= ptblocks[x].length) return {id: null, bumped: 0};
		return ptblocks[x][y];
	}
}

function get_block_collision(block, x=0, y=0){
	if (block.id == null) return;
	d = blockdata[block.id].collision;
	if (d == null) return;
	if (d[0] == 0 && d[1] == 0 && d[2] == 1 && d[3] == 1){
		return {x: x*tilew, y: y*tilew, w: tilew, h: tilew}; // simplified version of below (should be faster)
	} else {
		return {x: Math.floor((x+d[0])*tilew), y: Math.floor((y+d[1])*tilew), w: Math.ceil(d[2]*tilew), h: Math.ceil(d[3]*tilew)};
	}
}

function point_intersects_box(x, y, b){
	return !(y < b.y || y > b.y+b.h || x < b.x || x > b.x+b.w);
}

function point_collides_block(x, y, checkair=false, ignorepartial=false){
	nx = Math.floor(x/tilew), ny = Math.floor(y/tilew);
	block = get_playtest_tile(nx, ny, 0);
	if (checkair && block.id == null) b = {x: x, y: y, w: tilew, h: tilew};
	else b = get_block_collision(block, nx, ny);
	if (b == null || !point_intersects_box(x, y, b)) return;
	if (ignorepartial){ // ignore partially solid blocks like semisolids
		d = blockdata[block.id];
		if (get_property(d, "semisolid") != 0 || get_property(d, "hidden")) return;
	}
	return block;
}

function point_collides_block_property(x, y, name, ...args){
	block = point_collides_block(x, y, ...args);
	if (block != null) return get_property(blockdata[block.id], name);
}

function activate_block_at_point(x, y, ply, top=true){
	block = point_collides_block(x, y);
	if (block != null) return activate_block(Math.floor(x/tilew), Math.floor(y/tilew), ply, block, top);
}

function center_difference(ent1, ent2){
	diff = ent1.hbox_l+ent1.hbox.w/2-ent2.hbox_l-ent2.hbox.w/2;
	if (diff == 0) diff = Math.random()-.5;
	return diff;
}

function set_playtest_tile(x, y, t, overwrite=false){
	if (x < 0  || y < 0 || y > areasettings.areah-1) return;
	while (ptblocks.length <= x){
		ptblocks.push(Array(areasettings.areah).fill(null));
	}
	if (t.id == null){
		if (t.type == 0){
			ptblocks[x][y] = {id: null, bumped: 0};
		}
	} else if (t.type == 0){
		if (ptblocks[x][y].id == null || overwrite) ptblocks[x][y] = {id: t.id, contents: [], originalcontents: [], bumped: 0};
		else ptblocks[x][y].id = t.id;
	}
}

function draw_ui_part(d, x, y){
	ctx.drawImage(uisheet, d.x, d.y, d.w, d.h, x, y, d.w, d.h);
}

function get_sprite_data(tile, redirect=true){
	if (tile.type == 0) d2 = blockdata[tile.id];
	else if (tile.type == 1) d2 = entitydata[tile.id];
	if (redirect && d2.show != null && d2.show.tile != null){
		tile.originalid = tile.id;
		tile.id = d2.show.tile;
		return get_sprite_data(tile, false);
	}
	return d2;
}

function draw_hotbar_sprite(d2, x, y, type, scale=1){
	if (type == 0) s = blocksheet;
	else if (type == 1) s = entitysheet;
	nx = x-tilew/2+tilew*(1-scale), ny = y+tilew*(1-scale);
	nw = d2.w*scale, nh = d2.h*scale;
	div = Math.max(d2.w/tilew, d2.h/tilew);
	if (div != 1){
		if (d2.w > d2.h) ny += tilew/2-nh/div/2;
		else if (d2.h > d2.w) nx += tilew/2-nw/div/2;
		nw /= div, nh /= div;
	}
	ctx.drawImage(s, d2.x, d2.y, d2.w, d2.h, nx, ny, nw, nh);
}

function dict_get(dict, key, df){
	if (key in dict) return dict[key];
	return df;
}

function dict_matches(dict, fields){
	for (f of Object.keys(fields)){
		if (dict[f] != fields[f]) return false;
	}
	return true;
}

function cycle_menus(){
	if (!prefs.topbarshown && !prefs.bottombarshown){
		prefs.topbarshown = true;
	} else if (prefs.topbarshown && !prefs.bottombarshown){
		prefs.topbarshown = prefs.bottombarshown = true;
	} else {
		prefs.topbarshown = prefs.bottombarshown = false;
	}
	save_preferences();
}

function click_hotbar_slot(n, showvariants=false){
	checkhotbar = true;
	if (n == null){
		if (menu.id == "tiles"){ // x button clicked
			if (menu.returnto != null){
				if (menu.returnto.contentsdir != null) cd = [...menu.returnto.contentsdir];
				else cd = null;
				set_menu("entity", menu.returnto.num);
				if (cd != null) menu.contentsdir = [...cd];
				menu.reqrelease = true;
				placemode = -1;
			} else {
				set_menu();
				reqrelease = true;
				clear_placemode();
			}
			return;
		}
		if (!showvariants || curtile.hotbarslot != null){
			set_menu("tiles", 0); // menu button clicked
			return;
		}
		n = curtile, checkhotbar = false;
	}
	if (typeof n == "number"){
		n = hotbaritems[n];
		checkhotbar = false;
	}
	tile = {...n, id: n.originalid || n.id};
	if (showvariants){
		v = get_sprite_data(tile, false).variants;
		if (v != null && v.length > 1){
			menu.id = "tiles", menu.subpage = "variants";
			menu.variantdata = {tiles: v, category: get_sprite_data(tile, false).show.category, type: tile.type};
			if (!checkhotbar) menu.noback = true;
		}
		return;
	}
	if (!in_placing_mode()) clear_placemode();
	returnto = null;
	if (menu.id == "tiles"){ // selection from tiles menu
		if (menu.returnto != null){
			returnto = {...menu.returnto};
			if (menu.returnto.contentsdir != null) returnto.contentsdir = [...menu.returnto.contentsdir];
		}
		set_menu();
		reqrelease = true;
	} else if (menu.id != null) set_menu(); // close existing menu
	if (returnto != null){
		if (tile.type == 1) tile.conf = entitydata[tile.id].conf || {};
		ent = returnto.num;
		if (typeof ent == "number") ent = entities[ent];
		if (returnto.contentsdir != null){
			for (i = 0; i < returnto.contentsdir.length; i++){
				ent = get_config(ent, returnto.contentsdir[i]);
			}
			set_config(ent, returnto.category, tile);
			set_menu(returnto.menuid || "entity", returnto.num, "contents");
			menu.contentsdir = [...returnto.contentsdir];
		} else {
			set_config(ent, returnto.category, tile);
			set_menu(returnto.menuid || "entity", returnto.num);
		}
		menu.reqrelease = true;
		placemode = -1;
		if (returnto.validation != null) returnto.validation(entities[returnto.num]);
	} else {
		curtile = tile;
		if (checkhotbar) check_curtile_in_hotbar();
	}
}

function rounded_rect(x, y, w, h, r=0){
	if (w/2 < r) r = w/2;
	if (h/2 < r) r = h/2;
	ctx.beginPath();
	ctx.moveTo(x+r, y);
	ctx.arcTo(x+w, y, x+w, y+h, r);
	ctx.arcTo(x+w, y+h, x, y+h, r);
	ctx.arcTo(x, y+h, x, y, r);
	ctx.arcTo(x, y, x+w, y, r);
	ctx.closePath();
}

function test_hotbar_click(d, x, y, name, tile, unselect=false, disallow=false){
	if (mousex == null) return false;
	if (!(mousex >= x && mousex <= x+d.w && mousey >= y && mousey <= y+d.h)) return false;
	draw_ui_part(uidata[disallow?"hotbarhover2":"hotbarhover"], x, y);
	if (name != null){
		ctx.font = "20px Arial";
		ctx.fillStyle = "white";
		w = ctx.measureText(name).width+10;
		ctx.fillRect(x+d.w/2-w/2, y+d.h+3, w, 24);
		ctx.fillStyle = "black";
		ctx.textAlign = "center";
		ctx.fillText(name, x+d.w/2, y+d.h+23);
	}
	if (disallow) return true;
	if (lmdown == 1){
		if (unselect && in_placing_mode(-1)){
			if (!in_placing_mode()) clear_placemode();
			set_menu();
			curtile = null;
		} else {
			click_hotbar_slot(tile);
		}
	} else if (rmdown == 1){
		click_hotbar_slot(tile, true);
	}
	return true;
}

function test_ui_button_click(d, x, y, name, func, unselect=false, labeltop=false){
	if (mousex == null) return;
	cx = mousex-x-d.w/2, cy = mousey-y-d.h/2;
	if (cx*cx+cy*cy > (d.w/2)*(d.w/2)) return false;
	draw_ui_part(uidata.uibtnhover, x, y);
	if (name != null){
		ctx.font = "20px Arial";
		ctx.fillStyle = "white";
		labelw = ctx.measureText(name).width+10;
		if (y > maxh-uidata.bottom.h || labeltop) y = y-28;
		else y = y+d.h+3;
		ctx.fillRect(x+d.w/2-labelw/2, y, labelw, 24);
		ctx.fillStyle = "black";
		ctx.textAlign = "center";
		ctx.fillText(name, x+d.w/2, y+20);
	}
	if (lmdown != 1) return true;
	if (func != null) func();
	return true;
}

function make_ui_button(d, x, y, name, func, unselect=false, checkhover=true, labeltop=false){
	if (unselect) d2 = uidata.uibtnselected;
	else d2 = uidata.uibtnoutline;
	draw_ui_part(d2, x, y);
	draw_ui_part(d, x+d2.w/2-d.w/2, y+d2.h/2-d.h/2);
	if (checkhover) return test_ui_button_click(d2, x, y, name, func, unselect, labeltop);
	return false;
}

function toggle_placemode(n){
	set = placemode != n;
	clear_placemode();
	set_menu();
	if (!set) return false;
	placemode = n;
	return true;
}

function toggle_menu(id, force=false){
	if (menu.id != id || force){
		set_menu(id);
		if (in_placing_mode(1, 4)){
			clear_placemode();
			placemode = -1;
		}
		return true;
	} else {
		set_menu();
		if (placemode == -1) clear_placemode();
		return false;
	}
}

function click_erase_button(){toggle_placemode(1)}
function click_multiselect_button(){toggle_placemode(2)}
function click_fillbucket_button(){toggle_placemode(3)}
function click_save_button(){toggle_menu("saveload")}
function click_multiselect_edit_button(){toggle_menu("selectionedit")}
function click_multiselect_fliph_button(){flip_selected_tiles(false)}
function click_multiselect_flipv_button(){flip_selected_tiles(true)}
function click_new_subarea_button(){save_session("new")}
function click_delete_subarea_button(){save_session("delete")}

function click_reset_preferences_button(){
	prefs = {
		topbarshown: true, bottombarshown: true, tapjump: true, prevententitystack: true,
		showhitboxes: false, framebyframe: false, lockcamera: false,
		area: 0, character: 0, fpslimit: 60, showfpsdrop: false, zoom: 1, sfxvolume: 80, musicvolume: 80
	};
}

function click_save_clipboard_button(){
	save();
	clear_placemode();
	set_menu();
	reqrelease = true;
}

function click_save_file_button(){
	save(true);
	clear_placemode();
	set_menu();
	reqrelease = true;
}

function click_load_clipboard_button(){
	load_from_clipboard();
	clear_placemode();
	set_menu();
	reqrelease = true;
}

function click_load_file_button(){
	load_from_file();
	clear_placemode();
	set_menu();
	reqrelease = true;
}

function click_multiselect_copy_button(){
	shift = shift_pressed();
	tiles = get_multiselect_data(true);
	set_menu();
	clear_placemode();
	if (shift){
		placemode = 4;
		selectedtiles = tiles;
		sort_selected_tiles("type");
	} else {
		reqrelease = true;
		compress_copy(tiles);
	}
}
	
function click_multiselect_paste_button(){
	if (!toggle_placemode(4)) return;
	navigator.clipboard.readText().then(function(text){
		data = decompress_object(text, 1);
		if (data == null || !Array.isArray(data)){
			alert("The clipboard does not contain pasteable data.");
			clear_placemode();
			return;
		}
		selectedtiles = data;
		sort_selected_tiles("type"); // make entities appear at the front
	}).catch(function(e){
		alert("Permission to access the clipboard has been denied. Please change your settings in order to paste.");
		clear_placemode();
	});
}	

function click_settings_button(){toggle_menu("settings")}
function click_preferences_button(){toggle_menu("prefs")}
function click_play_button(){initialize_level()}
function click_stop_button(){ptvars.playing = false}

function close_menu_widget(edit=true){
	if (menu.subpage != "widget") return true;
	if (edit && menu.widget.shift != null){
		ent = menu.page;
		if (typeof ent == "number"){
			ent = entities[ent];
			if (shift_editor_entity(menu.page, "edit", menu.widget.prev, get_config(ent, menu.widget.field)) === false){
				return false;
			}
		} else if (menu.id == "settings"){
			if (menu.widget.field == "areaname") save_session();
			else if (menu.widget.field == "area"){
				if (menu.widget.cur != null && menu.widget.cur != prefs.area) save_session("change", menu.widget.cur);
			}
		}
	}
	delete menu.widget;
	menu.subpage = (menu.contentsdir != null)?"contents":null;
	return true;
}

function convert_to_ptblocks(blockarr, nospawn=false){
	ptblocks = Array(blockarr.length).fill(null).map((_, x) => ([...blockarr[x]])); // copy blocks array
	startpos = null;
	for (x = 0; x < ptblocks.length; x++){
		for (y = 0; y < ptblocks[x].length; y++){
			id = ptblocks[x][y];
			if (id == null){
				ptblocks[x][y] = {id: id, bumped: 0};
				continue;
			} else if (typeof id == "object") continue;
			d = blockdata[id];
			if (d.playtestalt != null){
				id2 = d.playtestalt;
				d = blockdata[id2];
				w = d.w/tilew, h = d.h/tilew;
				id = get_dynamic_id(id2, x, y, id);
			} else {
				w = d.w/tilew, h = d.h/tilew;
				id = get_dynamic_id(id, x, y);
				d = blockdata[id];
			}
			if (d.invisblocks != null){
				for (pos of d.invisblocks){
					while (x+pos[0] > ptblocks.length-1){
						ptblocks.push(Array(areasettings.areah).fill(null));
					}
					if (ptblocks[x+pos[0]][y+pos[1]] == null){
						ptblocks[x+pos[0]][y+pos[1]] = {id: "invistile", contents: [], originalcontents: [],
							bumped: 0, specialredirect: [x, y]};
					}
				}
			}
			if (get_property(d, "generator") != null && !nospawn){
				obj = spawn_entity({id: "generator", x: x+d.w/tilew/2, y: y+d.h/tilew/2,
					conf: {copycontents: [x, y], ...d.props.generator}});
			}
			if (id == "start") startpos = [x, y], id = "air";
			ptblocks[x][y] = {id: id, contents: [], originalcontents: [], bumped: 0};
		}
	}
	return startpos;
}

function convert_to_ptentities(entityarr, nospawn=false){
	ptvars.entitystates = [], ptvars.spawnlines = {};
	for (i = 0; i < entityarr.length; i++){
		ent = entityarr[i];
		spawn = true;
		if (block_containing_entity(ent)){
			b = ptblocks[ent.x][ent.y];
			if (b.id != null){
				spawn = false;
				if (ent.id == "coin10" && ent.conf.contents == null && get_property(blockdata[b.id], "generator") == null){
					for (j = 0; j < 10; j++) b.contents.push({id: "coin", type: 1, conf: {}});
				} else b.contents.push(i);
				b.originalcontents = [...b.contents];
			}
		}
		if (spawn && !nospawn) make_spawn_lines(spawn_entity(ent, null, true), i);
		ptvars.entitystates.push({state: +spawn, respawn_id: null, contents_respawn: null});
	}
}

function initialize_level(fromfade=0){
	checkpos = null;
	if (fromfade == 1 && ptvars.checkpoint != null) checkpos = [...ptvars.checkpoint];
	if (levelsettings.startarea != prefs.area) leveldata = save_session("change", levelsettings.startarea);
	else leveldata = save_session();
	clear_placemode();
	ptentities = [], ptparticles = [];
	startpos = convert_to_ptblocks(blocks);
	if (startpos != null || checkpos != null){
		playerent = {id: "player", x: startpos[0], y: startpos[1], conf: {}};
		if (levelsettings.playerent != null && levelsettings.playerent.id == "player" && levelsettings.playerent.type == 1){
			playerent.conf = {...levelsettings.playerent.conf};
		}
	}
	if (checkpos != null && prefs.area != checkpos[2]){
		leveldata = save_session("change", checkpos[2]);
		ptentities = [];
		convert_to_ptblocks(blocks);
	}
	ptvars = {...ptvars,
		playing: false,
		checkpoint: null,
		levelw: Math.max(ptblocks.length*tilew, maxw),
		levelh: areasettings.areah*tilew,
		onoff: Array(4).fill(false),
		keycoins: Array(4).fill(0),
		pswitch: 0,
		globaltimer: 0,
		leveltimer: (levelsettings.timer == 0)?-1:(levelsettings.timer*prefs.fpslimit)
	};
	if (fromfade > 0){
		if (checkpos != null) ptvars.checkpoint = [...checkpos];
	} else {
		ptvars.has_start = startpos != null;
		ptvars.playerlives = levelsettings.playerlives;
		set_global_freeze();
	}
	for (area of leveldata.areas){
		if (area.keycoins != null){
			for (k of Object.keys(area.keycoins)){
				ptvars.keycoins[k] += area.keycoins[k];
			}
		}
	}
	if (startpos != null || checkpos != null){
		if (checkpos != null) playerent.x = checkpos[0], playerent.y = checkpos[1];
		p = new Player(playerent);
		ptentities.push(p);
	}
	ptvars.playing = true;
	convert_to_ptentities(entities);
	p = get_player_entity();
	if (p != null){
		if (!prefs.lockcamera) scrollx = -p.x-p.sprite.w/2+maxw/2, scrolly = -p.y+tilew+maxh/2;
		clamp_scroll();
	}
	if (checkpos != null && prefs.area == checkpos[2]) ptblocks[checkpos[0]][checkpos[1]].id = "checkpointvisited";
	set_menu();
	for (globaliter = 0; globaliter < ptentities.length; globaliter++){
		ptentities[globaliter].check_despawn(true);
	}
	sessionStorage.removeItem("ptareas");
}

function shift_editor_entity(ent, action, prev=null, cur=null){
	n = null;
	if (typeof ent == "number"){
		n = ent;
		ent = entities[ent];
	}
	d = entitydata[ent.id];
	ret = null;
	if (d.class != null && d.class.editor_shift != null) ret = d.class.editor_shift(ent, action, prev, cur);
	if (action == "delete"){
		entities.splice((n == null)?entities.indexOf(ent):n, 1);
	}
	return ret;
}

function editor_warp_shift(ent, action, prev, cur, type=0){
	if (prev == null) prev = get_config(ent, "name");
	if (action == "edit" && cur == "") action = "delete";
	warps = levelsettings.warps;
	x = ent.x, y = ent.y;
	d = entitydata[ent.id];
	if (type == 0) x += d.w/tilew/2, y += d.h/tilew;
	else if (type == 1) x += .5, y += .5;
	if (action == "place"){ // place ent
		set_config(ent, "name", ""); // reset name if already has config data from middle clicking
	} else if (action == "delete"){ // delete ent
		for (i = 0; i < warps.length; i++){
			if (dict_matches(warps[i], {name: prev, x: x, y: y, area: prefs.area, type: type})){
				levelsettings.warps.splice(i, 1);
				break;
			}
		}
	} else if (action == "move"){ // position change
		if (prev == null || prev == "") return;
		for (i = 0; i < warps.length; i++){
			if (dict_matches(warps[i], {name: prev, area: prefs.area, type: type})){
				levelsettings.warps[i].x = x;
				levelsettings.warps[i].y = y;
				break;
			}
		}
	} else if (action == "edit"){ // edit name
		if (prev != cur){
			while (count_matching(warps, w => w.name == cur && w.type == type) > 0){
				cur += " (2)";
				set_config(ent, "name", cur);
			}
		}
		if (prev != null && prev != ""){ // remove existing warp
			for (i = 0; i < warps.length; i++){
				if (dict_matches(warps[i], {name: prev, x: x, y: y, area: prefs.area, type: type})){
					levelsettings.warps.splice(i, 1);
					break;
				}
			}
		}
		w = {name: cur, x: x, y: y, area: prefs.area, type: type};
		if (type == 1){
			w.dir = get_config(ent, "direction");
			w.size = get_config(ent, "size");
		}
		levelsettings.warps.unshift(w);
	} else if (action == "other"){ // direction/size change
		if (prev == null || prev == "") return;
		for (i = 0; i < warps.length; i++){
			if (dict_matches(warps[i], {name: prev, x: x, y: y, area: prefs.area, type: type})){
				if (type == 1){
					levelsettings.warps[i].dir = get_config(ent, "direction");
					levelsettings.warps[i].size = get_config(ent, "size");
				}
				break;
			}
		}
	}
}

function get_warp_names(ent){
	return levelsettings.warps.filter(w => w.type == menu.widget.warptype).map(w => w.name);
}

function go_to_warp(name, type){
	warp = levelsettings.warps.find(w => w.name == name && w.type == type);
	if (warp == null) return;
	set_menu();
	clear_placemode();
	reqrelease = true;
	if (warp.area != prefs.area) save_session("change", warp.area);
	scrollx = warp.x*-tilew+maxw/2;
	scrolly = warp.y*-tilew+maxh/2+tilew;
	clamp_scroll();
}

function get_subarea_names(){
	return JSON.parse(sessionStorage.getItem("level")).areas.map(a => a.areaname);
}

function sort_selected_tiles(method, ...args){
	if (method == "type"){
		selectedtiles.sort(function(a, b){
			if (a.type < b.type) return -1;
			if (a.type > b.type) return 1;
			return 0;
		});
	} else if (method == "offset"){
		selectedtiles.sort(function(a, b){
			if (a.type != 0 || b.type != 0) return 0;
			return (b.x-a.x)*args[0] || (b.y-a.y)*args[1];
		});
	} else if (method == "entitynum"){
		selectedtiles.sort(function(a, b){ 
			if (a.type != 1 || b.type != 1) return 0;
			return b.num-a.num;
		});
	}
}

function delete_selected_tiles(){
	sort_selected_tiles("entitynum"); // put the later entities first so splicing doesn't mess up everything
	for (t of selectedtiles){
		if (t.type == 0) set_tile(t.x, t.y, {id: null, type: 0});
		else if (t.type == 1) shift_editor_entity(t.num, "delete");
	}
	selectionrect = null, selectedtiles = [];
}

function flip_selected_tiles(vert){
	tiles = get_multiselect_data(false);
	b = get_multiselect_bounds(tiles);
	b.minx = Math.floor(b.minx), b.miny = Math.floor(b.miny);
	b.maxx = Math.ceil(b.maxx), b.maxy = Math.ceil(b.maxy);
	delete_selected_tiles();
	if (vert){
		for (t of tiles) t.y = b.miny+b.maxy-t.y;
	} else {
		for (t of tiles) t.x = b.minx+b.maxx-t.x;
	}
	selectedtiles = place_multiselect_data(tiles);
}

function check_popout_menu_close(x, y, w, h){
	if (lmdown == -1 && mousex != null && !menu.reqrelease && get_hovered_toolbar() == 0){
		if (mousex < x || mousex > x+w || mousey < y || mousey > y+h){
			set_menu();
			if (placemode == -1) clear_placemode();
		}
	}
}

function update_fps(now, x, y){
	if (now == null) return;
	if (refreshtimestamp != null){
		prev = fps;
		fps = 1000/(now-refreshtimestamp);
		r = Math.round(fps/2)*2;
		if (x != null){ // draw fps if x pos is provided
			ctx.font = "20px Arial"
			ctx.fillStyle = "black";
			ctx.textAlign = "left";
			if (y == null) y = prefs.topbarshown*uidata.top.h;
			text = "FPS: "+r;
			if (fpsdrop != null){
				text += ", DROP: "+Math.round(fpsdrop[0]/2)*2;
				if (fpsdrop[2] > 1) text += " x"+fpsdrop[2];
			}
			ctx.fillText(text, x, y+20);
			if (prefs.showfpsdrop && Math.round(prev/2)*2 < r){
				fpsdrop = [prev, frame, (fpsdrop != null)?(fpsdrop[2]+1):1];
			}
			if (fpsdrop != null && frame-fpsdrop[1] > 30) fpsdrop = null;
		}
	}
	refreshtimestamp = now;
}

function draw_entity_menu(ent, x, y, w, h, menuclass, name){
	ctx.fillStyle = "#999", ctx.strokeStyle = "#666", ctx.lineWidth = 4;
	rounded_rect(x, y, w, h, 10);
	ctx.fill();
	ctx.stroke();
	
	EntityMenu.set_color(1);
	ctx.font = "bold 18px Arial", ctx.textAlign = "center";
	if (mousex != null && mousex >= x+2 && mousex <= x+22 && mousey >= y+2 && mousey <= y+22){
		infohover = true;
		ctx.fillStyle = "#666";
	} else infohover = false;
	if (menu.subpage == "widget"){
		ctx.fillText("<", x+12, y+19);
		name = menu.widget.name, type = menu.widget.type;
		menuclass = MenuWidgets[menu.widget.type];
		if (ent == null) ent = menu.page;
	} else if (menu.subpage == "contents"){
		ctx.fillText("<", x+12, y+19);
		EntityMenu.reset_styling();
		ctx.font = "19px Arial", ctx.textAlign = "left";
		ctx.fillText(menu.contentsdir.length, x+19, y+19);
	} else if (menu.subpage == "info"){
		ctx.fillText("x", x+10, y+16);
		menuclass = MenuPresets.info;
	} else if (typeof menu.page == "number"){
		ctx.fillText("i", x+9, y+19);
	}
	
	EntityMenu.reset_styling();
	ctx.font = "bold 24px Arial", ctx.textAlign = "center";
	ctx.fillText(name, x+w/2, y+28);
	EntityMenu.reset_styling();
	menuclass(ent, x+15, y+45, w-30, h-45);
	
	if (lmdown == 1 && infohover){
		if (menu.subpage == "widget") close_menu_widget();
		else if (menu.subpage == "contents"){
			menu.contentsdir.pop();
			if (menu.contentsdir.length == 0){
				delete menu.contentsdir;
				menu.subpage = null;
			}
		} else if (menu.subpage == "info") menu.subpage = null;
		else menu.subpage = "info";
		menu.reqrelease = true;
	} else check_popout_menu_close(x, y, w, h);
	if (lmdown == -1 && menu.reqrelease) delete menu.reqrelease;
	ctx.globalAlpha = 1;
}

function draw_ui(now){
	if (selectedtiles.length > 0 && placemode == 2){ // selected tiles
		ctx.fillStyle = "rgba(255, 255, 0, .2)";
		ctx.strokeStyle = "rgb(255, 255, 0)";
		ctx.lineWidth = 3;
		drawn = [];
		for (t of selectedtiles){
			if (t.type == 0){
				block = get_tile(t.x, t.y, 0);
				if (block == null) d = {w: tilew, h: tilew};
				else d = blockdata[block];
				b = {x: t.x*tilew, y: t.y*tilew, w: d.w, h: d.h};
			} else if (t.type == 1){
				ent = entities[t.num];
				if (block_containing_entity(ent)){
					b = {x: (ent.x+.4)*tilew, y: (ent.y+.4)*tilew, w: tilew*.6, h: tilew*.6};
				} else {
					d = entitydata[ent.id];
					b = {x: ent.x*tilew, y: ent.y*tilew, w: d.w, h: d.h};
				}
			}
			ok = true;
			for (b2 of drawn){
				if (b2.x == b.x && b2.y == b.y && b2.w == b.w && b2.h == b.h){
					ok = false;
					break;
				}
			}
			if (!ok) continue;
			ctx.beginPath();
			ctx.rect(b.x+scrollx, b.y+scrolly, b.w, b.h);
			ctx.fill();
			ctx.stroke();
			drawn.push({...b});
		}
	}
	if (menu.id == "entity"){ // entity menu
		if (menu.subpage != "widget" && shift_pressed()) ctx.globalAlpha = .6;
		ent = entities[menu.page];
		x = ent.x*tilew+scrollx+20, lx = x-40;
		ny = ent.y*tilew+scrolly;
		if (block_containing_entity(ent)) x += tilew, ny += tilew/2;
		else {
			d = entitydata[ent.id];
			x += d.w, ny += d.h/2;
		}
		if (menu.contentsdir != null){
			for (i = 0; i < menu.contentsdir.length; i++){
				ent = get_config(ent, menu.contentsdir[i]);
			}
		}
		d = entitydata[ent.id];
		w = d.widemenu?400:300, h = 205+(d.extralines || 0)*23;
		ny -= h/2;
		y = Math.min(ny, maxh-(prefs.bottombarshown?uidata.bottom.h:0)-h-5); // clamp y pos
		y = Math.max(y, (prefs.topbarshown?uidata.top.h:0)+5);
		left = false;
		if (x+w >= maxw-5) x = lx-w, left = true;
		ctx.strokeStyle = "#666", ctx.lineWidth = 4;
		if (ny+h/2 >= y+5 && ny+h/2 <= y+h-5){ // line pointing to entity
			ctx.beginPath();
			if (left){
				ctx.moveTo(x+w, ny+h/2);
				ctx.lineTo(x+w+15, ny+h/2);
			} else {
				ctx.moveTo(x-15, ny+h/2);
				ctx.lineTo(x, ny+h/2);
			}
			ctx.stroke();
		}
		rounded_rect(x, y, w, h, 10);
		ctx.fill();
		ctx.stroke();
		draw_entity_menu(ent, x, y, w, h, d.menu || MenuPresets.global_blank, (d.show != null && d.show.name != null)?d.show.name:ent.id);
	} else if (menu.id == "settings"){ // settings menu
		w = 400, h = 380;
		x = maxw-w-2, y = maxh-h-2;
		if (prefs.bottombarshown) y -= uidata.bottom.h;
		ent = null, menuclass = MenuPresets.level_settings;
		if (menu.contentsdir != null){
			ent = levelsettings;
			for (i = 0; i < menu.contentsdir.length; i++){
				ent = get_config(ent, menu.contentsdir[i]);
			}
			d = entitydata[ent.id];
			menuclass = d.menu || MenuPresets.global_blank;
		}
		draw_entity_menu(ent, x, y, w, h, menuclass, "Settings");
	} else if (menu.id == "prefs"){ // preferences menu
		w = 400, h = 310;
		x = maxw-w-2, y = maxh-h-2;
		if (prefs.bottombarshown) y -= uidata.bottom.h;
		draw_entity_menu(null, x, y, w, h, MenuPresets.preferences, "Preferences");
	} else if (menu.id == "saveload"){ // save/load menu
		w = 200, h = 225;
		midx = maxw-290+uidata.uibtnselected.w/2;
		x = midx-w/2, y = maxh-h-2;
		if (prefs.bottombarshown) y -= uidata.bottom.h;
		ctx.fillStyle = "#75cfff", ctx.strokeStyle = "#4bbdfa", ctx.lineWidth = 4;
		rounded_rect(x, y, w, h, 10);
		ctx.fill();
		ctx.stroke();
		ctx.font = "20px Arial", ctx.textAlign = "center";
		ctx.fillStyle = "black";
		ctx.fillText("Save", midx-5-uidata.uibtnoutline.w/2, y+25);
		ctx.fillText("Load", midx+5+uidata.uibtnoutline.w/2, y+25);
		make_ui_button(uidata.downloadicon, midx-5-uidata.uibtnoutline.w, y+h-190, "Download file",
			click_save_file_button, false, true, true);
		make_ui_button(uidata.loadicon, midx+5, y+h-190, "Open file",
			click_load_file_button, false, true, true);
		make_ui_button(uidata.copyicon, midx-5-uidata.uibtnoutline.w, y+h-95, "Copy to clipboard",
			click_save_clipboard_button, false, true, true);
		make_ui_button(uidata.clipboardicon, midx+5, y+h-95, "From clipboard",
			click_load_clipboard_button, false, true, true);
		check_popout_menu_close(x, y, w, h);
	} else if (menu.id == "selectionedit"){ // multiselect edit selection menu
		w = 200, h = 225;
		midx = maxw-195+uidata.uibtnselected.w/2;
		x = midx-w/2, y = maxh-h-2;
		if (prefs.bottombarshown) y -= uidata.bottom.h;
		ctx.fillStyle = "#75cfff", ctx.strokeStyle = "#4bbdfa", ctx.lineWidth = 4;
		rounded_rect(x, y, w, h, 10);
		ctx.fill();
		ctx.stroke();
		ctx.font = "20px Arial", ctx.textAlign = "center";
		ctx.fillStyle = "black";
		ctx.fillText("Edit selection", midx, y+25);
		make_ui_button(uidata.fliphicon, midx+5, y+h-190, "Flip horizontal",
			click_multiselect_fliph_button, false, true, true);
		make_ui_button(uidata.copyicon, midx-5-uidata.uibtnoutline.w, y+h-95, "Copy",
			click_multiselect_copy_button, false, true, true);
		make_ui_button(uidata.flipvicon, midx+5, y+h-95, "Flip vertical",
			click_multiselect_flipv_button, false, true, true);
		check_popout_menu_close(x, y, w, h);
	}
	if (prefs.topbarshown){ // top bar
		d = uidata.top;
		ctx.drawImage(uisheet, d.x, d.y, d.w, d.h, 0, 0, maxw, d.h);
		d = (curtile != null && curtile.hotbarslot == null)?uidata.hotbarmenu2:uidata.hotbarmenu;
		x = maxw-9-d.w, y = 9;
		draw_ui_part(d, x, y);
		if (curtile != null && curtile.hotbarslot == null){
			d2 = get_sprite_data({...curtile}, true);
			draw_hotbar_sprite(d2, x+d.w/2, y+11, curtile.type, .6);
		}
		test_hotbar_click(d, x, y, "All Tiles (T)");
		x -= 15;
		showselected = (in_placing_mode() && !(placemode == 3 && shift_pressed())) || placemode < 0;
		for (i = 0; i < hotbaritems.length; i++){
			h = hotbaritems[i];
			h.hotbarslot = i;
			d2 = get_sprite_data(h);
			curslot = curtile != null && curtile.hotbarslot == i;
			if (curslot && showselected) d = uidata.hotbarselected;
			else d = uidata["hotbar"+dict_get(d2, "show", {category: 0}).category];
			x -= d.w;
			draw_ui_part(d, x, y);
			draw_hotbar_sprite(d2, x+d.w/2, y+11, h.type);
			if (h.originalid != null){
				test_hotbar_click(d, x, y, get_sprite_data({id: h.originalid, type: h.type}, false).show.name, i, curslot);
			} else {
				test_hotbar_click(d, x, y, d2.show.name, i, curslot);
			}
			x -= 15;
		}
		update_fps(now, 3);
		d = uidata.erasericon;
		if (placemode == 1 && lmdown > 40 && !reqrelease) d = uidata.erasericon2;
		make_ui_button(d, 12, y, "Eraser (E)", click_erase_button, placemode == 1 || (!showselected && in_placing_mode()));
		fillfront = placemode == 3;
		if (!fillfront){
			make_ui_button(uidata.bucketicon, 170, y, "Fill Bucket (B)", click_fillbucket_button, false, mousex > 182);
		}
		make_ui_button(uidata.multiselecticon, 110, y, "Multiselect (Q)", click_multiselect_button, placemode == 2, mousex <= 182);
		if (fillfront){
			make_ui_button(uidata.bucketicon, 170, y, "Fill Bucket (B)", click_fillbucket_button, true, mousex > 182);
		}
	} else {
		draw_ui_part(uidata.toptab, 5, 0);
		draw_ui_part(uidata.toptab, maxw-5-uidata.toptab.w, 0);
		for (i = 0; i < hotbaritems.length; i++) hotbaritems[i].hotbarslot = i;
		update_fps(now, uidata.toptab.w+9);
	}
	if (prefs.bottombarshown){ // bottom bar
		d = uidata.bottom;
		ctx.drawImage(uisheet, d.x, d.y, d.w, d.h, 0, maxh-uidata.bottom.h, maxw, d.h);
		y = maxh-93;
		make_ui_button(uidata.saveicon, maxw-385, y, "Save / Load", click_save_button, menu.id == "saveload");
		if (selectedtiles.length > 0 && placemode == 2){
			make_ui_button(uidata.arrowsicon, maxw-290, y, "Edit selection", click_multiselect_edit_button, menu.id == "selectionedit");
		} else {
			make_ui_button(uidata.pasteicon, maxw-290, y, "Paste", click_multiselect_paste_button, placemode == 4);
		}
		d = (menu.id == "prefs")?uidata.prefsbtnselected:uidata.prefsbtn, x = maxw-193;
		draw_ui_part(d, x, y);
		test_ui_button_click(d, x, y, "Preferences", click_preferences_button);
		d = (menu.id == "settings")?uidata.settingsbtnselected:uidata.settingsbtn, x = maxw-d.w-11;
		draw_ui_part(d, x, y);
		test_ui_button_click(d, x, y, "Settings", click_settings_button);
		d = uidata.playbtn, x = 10;
		draw_ui_part(d, x, y);
		test_ui_button_click(d, x, y, "Play (P)", click_play_button);
	} else {
		draw_ui_part(uidata.bottomtab, 5, maxh-uidata.bottomtab.h);
		draw_ui_part(uidata.bottomtab, maxw-5-uidata.bottomtab.w, maxh-uidata.bottomtab.h);
	}
	if (selectionrect != null){ // selection rectangle
		ctx.fillStyle = "rgba(255, 255, 0, .2)", ctx.strokeStyle = "rgb(255, 255, 0)", ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.rect(selectionrect.x+scrollx, selectionrect.y+scrolly, selectionrect.w, selectionrect.h);
		ctx.fill();
		ctx.stroke();
	}
}

function draw_tile_menu(now){
	update_fps(now);
	ctx.fillStyle = "#75cfff", ctx.strokeStyle = "#4bbdfa", ctx.lineWidth = 4;
	rounded_rect(10, 10, maxw-20, maxh-20, 10);
	ctx.fill();
	ctx.stroke();
	y = 45;
	tests = [];
	if (menu.subpage == "variants"){
		x = 20;
		ctx.fillStyle = "black";
		ctx.font = "25px Arial", ctx.textAlign = "left";
		ctx.fillText("Select a variant", x+5, y);
		d = uidata["hotbar"+menu.variantdata.category];
		y += 10;
		for (b of menu.variantdata.tiles){
			d2 = get_sprite_data({id: b, type: menu.variantdata.type}, true);
			draw_ui_part(d, x, y);
			draw_hotbar_sprite(d2, x+d.w/2, y+11, menu.variantdata.type);
			if (d2.show == null || d2.show.name == null || d2.show.hidden){
				name = get_sprite_data({id: b, type: menu.variantdata.type}, false).show.name;
			} else name = d2.show.name;
			tests.push([d, x, y, name, {id: b, type: menu.variantdata.type}]);
			if ((y < 60 && x+10+d.w*4 > maxw-20) || x+10+d.w*2 > maxw-20){
				x = 20;
				y += d.h+10;
			} else x += d.w+10;
		}
		x = 20;
	} else {
		for (i = 0; i < indexedcategories.length; i++){
			cat = indexedcategories[i];
			x = 20;
			ctx.fillStyle = "black";
			ctx.font = "25px Arial", ctx.textAlign = "left";
			ctx.fillText(cat.name, x+5, y);
			d = uidata["hotbar"+i];
			y += 10;
			for (b of cat.tiles){
				d2 = get_sprite_data(b);
				draw_ui_part(d, x, y);
				draw_hotbar_sprite(d2, x+d.w/2, y+11, b.type);
				if (b.originalid != null) d2 = get_sprite_data({id: b.originalid, type: b.type}, false);
				tests.push([d, x, y, d2.show.name, b, false, menu.returnto != null && b.type == 1 && !d2.iscontents]);
				if (((y < 60 && x+10+d.w*3 > maxw-20) || x+10+d.w*2 > maxw-20) && b != cat.tiles[cat.tiles.length-1]){
					// wrap blocks onto next line if it collides with close button or edge of screen AND it is not the last block in the category
					x = 20, y += d.h+10;
				} else x += d.w+10; // increase x position for the next tile
			}
			y += d.h+30;
		}
	}
	for (t of tests){ // test for hover after drawing blocks in order for tooltips to be on the top layer
		test_hotbar_click(...t);
	}
	d = uidata.hotbarclose;
	x = maxw-d.w-18, y = 18;
	draw_ui_part(d, x, y);
	if (mousex != null && mousex >= x && mousex <= x+d.w && mousey >= y && mousey <= y+d.h){
		d2 = uidata.hotbarhover;
		ctx.drawImage(uisheet, d2.x, d2.y, d2.w, d2.h, x, y, d.w, d.h);
		if (lmdown == 1) click_hotbar_slot();
	}
	if (menu.subpage != null && !menu.noback){
		d = uidata.hotbarback;
		x = maxw-d.w-90, y = 18;
		draw_ui_part(d, x, y);
		if (mousex != null && mousex >= x && mousex <= x+d.w && mousey >= y && mousey <= y+d.h){
			d2 = uidata.hotbarhover;
			ctx.drawImage(uisheet, d2.x, d2.y, d2.w, d2.h, x, y, d.w, d.h);
			if (lmdown == 1) menu.subpage = null;
		}
	}
}

function draw_playtest_ui(now){
	d = uidata.stopbtn;
	x = 5, y = maxh-d.h-5;
	draw_ui_part(d, x, y);
	if (mousex != null){
		cx = mousex-x-d.w/2, cy = mousey-y-d.h/2;
		if (cx*cx+cy*cy <= (d.w/2)*(d.w/2)){
			d2 = uidata.uibtnhover;
			ctx.drawImage(uisheet, d2.x, d2.y, d2.w, d2.h, x, y, d.w, d.h);
			if (lmdown == 1) click_stop_button();
		}
	}
	y = 0;
	if (ptvars.has_start && ptvars.playing){ // draw inventory
		combinedinv = {extralife: ptvars.playerlives, coin: 0, starcoin: 0, key: 0};
		for (ent of ptentities){
			if (!ent.is_player) continue;
			for (item of Object.keys(ent.inventory)){
				combinedinv[item] ??= 0;
				combinedinv[item] += ent.inventory[item];
			}
		}
		for (item of Object.keys(combinedinv)){
			if (combinedinv[item] <= 0) continue;
			d = entitydata[item];
			if (d == undefined) continue;
			nw = d.w, nh = d.h;
			if (d.animations != null && d.animations.inventory != null){
				d = d.animations.inventory;
				nw = d.w/2, nh = d.h/2;
			}
			ctx.drawImage(entitysheet, d.x, d.y, nw, nh, 3, y+3, 32, 32);
			ctx.font = "20px Arial", ctx.fillStyle = "black", ctx.textAlign = "left";
			ctx.fillText("x", 38, y+29);
			ctx.fillText(combinedinv[item].toString(), 49, y+29);
			y += 35;
		}
	}
	if (ptvars.leveltimer >= 0){
		d = entitydata.leveltimer;
		ctx.font = "bold 24px Arial", ctx.fillStyle = "black", ctx.textAlign = "right";
		time = Math.ceil(ptvars.leveltimer/prefs.fpslimit).toString();
		ctx.fillText(time, maxw-7, 28);
		ctx.drawImage(entitysheet, d.x, d.y, d.w/2, d.h/2, maxw-12-d.w/2-ctx.measureText(time).width, 3, 32, 32);
	}
	gf = ptvars.globalfreeze;
	if (gf.id == "message" && gf.drawfunc != null) gf.drawfunc();
	else if (["prefade", "fade", "fade2", "fade3"].includes(gf.id)){
		if (gf.id == "prefade") f = 0;
		if (gf.id == "fade") f = (30-gf.frame)/30;
		else if (gf.id == "fade2") f = 1;
		else if (gf.id == "fade3") f = gf.frame/20;
		if (prefs.showhitboxes) f *= .5;
		ctx.fillStyle = "rgba(0, 0, 0, "+f+")";
		ctx.fillRect(0, 0, maxw, maxh);
	}
	update_fps(now, 3, y);
}

function finish_level(alive){
	if (alive){
		play_sound("finish");
	}
	click_stop_button();
}

function make_spawn_lines(ent, link){
	ent.link = link;
	left = (ent.x+ent.sprite.w)/tilew, right = ent.x/tilew;
	if (areasettings.spawnlines == null){
		left = Math.ceil(left*2)/2;
		right = Math.floor(right*2)/2;
	} else return; // custom spawn lines not implemented
	left += "L", right += "R";
	ptvars.spawnlines[left] ??= [];
	ptvars.spawnlines[right] ??= [];
	if (!ptvars.spawnlines[left].includes(link)) ptvars.spawnlines[left].push(link);
	if (!ptvars.spawnlines[right].includes(link)) ptvars.spawnlines[right].push(link);
}

function spawn_entity(ent, d=null, start=false){
	if (d == null) d = entitydata[ent.id];
	obj = new d.class(ent, d);
	if (obj.is_player){
		if (start) ptvars.has_start = true;
		n = ptentities.length;
		while (n > 0){
			if (ptentities[n-1].is_player) break;
			n--;
		}
		ptentities.splice(n, 0, obj);
	} else {
		n = ptentities.length;
		while (n > 0){
			if (d.class.bg_layer > entitydata[ptentities[n-1].id].class.bg_layer || ptentities[n-1].is_player) break;
			n--;
		}
		ptentities.splice(n, 0, obj);
	}
	return obj;
}

function spawn_entity_num(n, x=null, y=null, ply=null, top=null){
	if (typeof n == "number"){ // pre-placed entity
		obj = spawn_entity({...entities[n], x: x, y: y});
		obj.link = n;
	} else if (n.type == 0){ // block
		drop_contents({x: x, y: y, sprite: {w: tilew, h: tilew}, conf: {contents: {id: n.id, type: 0, conf: n.conf}}}, ply);
		return;
	} else if (n.type == 1){ // entity
		obj = spawn_entity({id: n.id, x: x, y: y, conf: n.conf});
	}
	if (top != null) obj.release(ply, top);
	return obj;
}

function spawn_from_line(ln){
	if (!(ln in ptvars.spawnlines)) return false;
	for (i of ptvars.spawnlines[ln]){
		if (ptvars.entitystates[i].state != 0) continue;
		obj = spawn_entity(entities[i]);
		obj.link = i;
		ptvars.entitystates[i].state = 1;
	}
	return true;
}

function spawn_from_step(id, x, y, ply){
	block = get_playtest_tile(x, y, 0);
	set_playtest_tile(x, y, {id: null, type: 0});
	if (block.id != null && block.contents.length > 0) release_all_contents(x, y, ply, block);
	else spawn_entity({id: id, x: x, y: y});
}

function spawn_particle(part, d=null){
	if (d == null) d = particledata[part.id];
	part.x -= d.w/2, part.y -= d.h/2;
	obj = new (d.class ?? ParticleBase)(part, d);
	ptparticles.unshift(obj);
}

function spawn_particle_at_entity(ent, id){
	return spawn_particle({id: id, x: ent.x+ent.sprite.w/2, y: ent.y+ent.sprite.h/2});
}

function spawn_hit_particle(ent, left, stomp){
	d = particledata.hit, x = left?ent.hbox_r:ent.hbox_l, y = ent.hbox_t;
	if (stomp) x += ent.hbox.w/(left?-4:4);
	else y += ent.hbox.h/2;
	spawn_particle({id: "hit", x: x, y: y});
}

function spawn_hit_particle_from_collision(ent, ply){
	return spawn_hit_particle(ent, center_difference(ent, ply) < 0, ply.check_stomp(ent));
}

function get_player_entity(){
	p = 0;
	while (p < ptentities.length){
		if (!ptentities[p].is_player) p++;
		else return ptentities[p];
	}
}

function set_global_freeze(cutscene){
	if (cutscene == null) cutscene = {id: null};
	if (cutscene.frame == null){
		if (cutscene.id == null) cutscene.frame = 0;
		else if (cutscene.id == "message") cutscene.frame = maxint;
		else if (cutscene.id == "prefade" || cutscene.id == "prenofade" || cutscene.id == "fade3") cutscene.frame = 20;
		else if (cutscene.id == "fade") cutscene.frame = 30;
		else if (cutscene.id == "nofade") cutscene.frame = 35;
		else if (cutscene.id == "fade2") cutscene.frame = 10;
		else if (cutscene.id == "nofade3") cutscene.frame = 25;
	}
	ptvars.globalfreeze = cutscene;
}

function change_playtest_area(dest){
	data = JSON.parse(sessionStorage.getItem("ptareas"));
	if (data == null) data = {};
	data[prefs.area] = {blocks: ptblocks, entitystates: ptvars.entitystates};
	save_session("change", dest); // load blocks and entities from target area
	if (dest in data){ // load cached data
		destdata = data[dest];
		ptblocks = destdata.blocks;
		ptvars.entitystates = destdata.entitystates;
	} else { // generate ptblocks and entitystates
		ptparticles = [];
		convert_to_ptblocks(blocks);
		convert_to_ptentities(entities, true);
	}
	prefs.area = dest;
	sessionStorage.setItem("ptareas", JSON.stringify(data));
}

function reload_area(dest, revert=true, playerhandle=null){
	if (revert || dest != prefs.area){
		prevptvars = {...ptvars};
		ptvars.globaltimer = 0;
		if (ptvars.pswitch > 0) trigger_pswitch(false, true); // disable pswitch so reloading bricks works
		for (globaliter = 0; globaliter < ptentities.length; globaliter++){ // remove all entities except players
			ent = ptentities[globaliter];
			if (ent.is_player){
				if (playerhandle != null) playerhandle(ent);
			} else {
				ptentities.splice(globaliter, 1);
				globaliter--;
			}
		}
		if (dest != prefs.area) change_playtest_area(dest);
		for (i = 0; i < entities.length; i++){ // respawn elegible entities
			if (ptvars.entitystates[i].respawn_id == "") continue;
			ent = entities[i];
			if (ptvars.entitystates[i].respawn_id != null) ent = {...ent, id: ptvars.entitystates[i].respawn_id};
			spawn = true;
			if (block_containing_entity(ent)) spawn = false;
			if (spawn){
				obj = spawn_entity(ent);
				obj.link = i;
				if (ptvars.entitystates[i].contents_respawn == "") delete obj.conf.contents;
			}
			ptvars.entitystates[i].state = +spawn;
		}
		p = get_player_entity();
		if (p != null){
			if (!prefs.lockcamera) scrollx = -p.x-p.sprite.w/2+maxw/2, scrolly = -p.y+tilew+maxh/2;
			clamp_scroll();
		}
		if (prevptvars.pswitch > 0){
			trigger_pswitch(true, true);
			ptvars.pswitch = prevptvars.pswitch;
		}
	} else {
		for (ent of ptentities){
			if (ent.is_player) playerhandle(ent);
		}
		for (i = 0; i < entities.length; i++){
			if (ptvars.entitystates[i].state != 0) continue;
			ent = entities[i];
			spawn = true;
			if (block_containing_entity(ent)) spawn = false;
			if (spawn){
				obj = spawn_entity(ent);
				obj.link = i;
				ptvars.entitystates[i].state = 1;
			}
		}
	}
	update_playtest_scroll();
	for (globaliter = 0; globaliter < ptentities.length; globaliter++){
		ptentities[globaliter].check_despawn(true);
	}
}

function update_playtest_scroll(p){
	if (prefs.lockcamera) return;
	if (p == null) p = get_player_entity();
	if (p == null || p.hbox == null) return;
	if (p.hbox_l+scrollx < maxw/2-tilew){ // left
		scrollx = -p.hbox_l+maxw/2-tilew+1;
		clamp_scroll();
		ln = Math.ceil(-scrollx/tilew*2)/2-3;
		if (ln >= 0 || ln <= ptvars.levelw/tilew) spawn_from_line(ln+"L");
	} else if (p.hbox_r+scrollx > maxw/2+tilew){ // right
		scrollx = -p.hbox_r+maxw/2+tilew-1;
		clamp_scroll();
		ln = Math.floor((-scrollx+maxw)/tilew*2)/2+3;
		if (ln >= 0 || ln <= ptvars.levelw/tilew) spawn_from_line(ln+"R");
	}
	if (p.hbox_t+scrolly < tilew*2){ // top
		scrolly = -p.hbox_t+tilew*2;
		clamp_scroll();
	} else if (p.hbox_b+scrolly > maxh-tilew*3){ // bottom
		scrolly = -p.hbox_b+maxh-tilew*3;
		clamp_scroll();
	}
}

function update_playtest_objects(){
	if (dirkeys.up) dirkeys.interact++;
	else dirkeys.interact = 0;
	gf = ptvars.globalfreeze;
	if (gf.id == "message"){
		gf.frame = maxint;
		if (gf.released == 0 && !dirkeys.jump) gf.released++;
		else if (gf.released == 1 && dirkeys.jump) gf.released++;
		else if (gf.released == 2 && !dirkeys.jump) set_global_freeze();
	}
	if (gf.frame > 0) gf.frame--;
	if (gf.id != null && gf.frame == 0){
		if (gf.next == null){
			next = {"prefade": "fade", "prenofade": "nofade", "fade": "fade2", "fade2": "fade3", "nofade": "nofade3"};
			if (gf.id in next) gf.next = {id: next[gf.id]};
		}
		gf.id = null;
		if (gf.next != null){
			set_global_freeze({...gf.next});
			if (gf.ontransition != null) gf.ontransition();
		}
	}
	for (globaliter = 0; globaliter < ptentities.length; globaliter++){
		ptentities[globaliter].full_update();
	}
	for (globaliter = 0; globaliter < ptparticles.length; globaliter++){
		ptparticles[globaliter].full_update();
	}
	if (ptvars.globalfreeze.id == null || gf.id == null){
		ok = false, i = 0;
		while (!ok){
			ok = true;
			for (globaliter = 0; globaliter < ptentities.length; globaliter++){
				if (ptentities[globaliter].handle_entity_collision() > 0) ok = false;
			}
			i++;
			if (i > 64){
				console.error("i > 64");
				break;
			}
		}
	}
	if (ptvars.globalfreeze.id == null){ // timers
		ptvars.globaltimer++;
		if (ptvars.pswitch > 0){
			ptvars.pswitch--;
			if (ptvars.pswitch == 0) trigger_pswitch(false);
		}
		if (ptvars.leveltimer > 0){
			ptvars.leveltimer--;
			if (ptvars.leveltimer == 0){
				count = count_matching(ptentities, ent => ent.is_player);
				for (globaliter = 0; globaliter < ptentities.length; globaliter++){
					ent = ptentities[globaliter];
					if (ent.is_player){
						count--;
						if (count == 0) ent.kill(null, 1);
						else ent.kill();
					}
				}
			}
		}
	}
	if (!ptvars.has_start || !ptvars.playing) return;
	p = get_player_entity();
	if ((p == null || (ptvars.playerlives == 0 && levelsettings.playerlives > 0)) && ptvars.globalfreeze.id == null){
		if (ptvars.playerlives > 0 || levelsettings.playerlives == 0){
			set_global_freeze({id: "prefade", next: {id: "fade", ontransition: () => initialize_level(1)}});
		} else finish_level(false);
		return;
	}
	if (p != null && p.cutscene.id == "pipe" && p.cutscene.frame < 5 && p.cutscene.entering) return;
	update_playtest_scroll(p);
}

function draw_playtest_objects(){
	frontlayer = [];
	for (x = 0; x < ptblocks.length; x++){
		for (y = 0; y < ptblocks[x].length; y++){
			block = ptblocks[x][y];
			if (block.id != null){
				d = blockdata[block.id];
				if (!(d.w > 0 && d.h > 0)) continue;
			}
			if (block.id == null || get_property(d, "hidden")){
				if (block.bumped > 0) ptblocks[x][y].bumped--;
				continue;
			}
			ok = true;
			if (block.bumped > 0){
				ptblocks[x][y].bumped--;
				frontlayer.push({id: block.id, x: x, y: y-(4-Math.abs(block.bumped-4))/tilew*(ptblocks[x][y].bumpeddown?-5:5)});
				ok = false;
			}
			if (ok) t = draw_tile(block.id, x, y, 0, false);
			if (prefs.showhitboxes){
				d = blockdata[block.id];
				if (d.collision != null){
					ctx.globalAlpha = .2;
					ctx.fillStyle = indexedcategories[0].color;
					ctx.fillRect((x+d.collision[0])*tilew+scrollx, (y+d.collision[1])*tilew+scrolly,
						d.collision[2]*tilew, d.collision[3]*tilew);
					ctx.globalAlpha = 1;
				}
			}
		}
	}
	for (globaliter = ptentities.length-1; globaliter >= 0; globaliter--){ // iterate in reverse order so player appears on top
		ptentities[globaliter].full_render(); // call the unique render function of each entity
	}
	for (globaliter = ptparticles.length-1; globaliter >= 0; globaliter--){
		ptparticles[globaliter].full_render();
	}
	if (!prefs.showhitboxes){
		for (d of frontlayer) draw_tile(d.id, d.x, d.y, 0, false);
	}
}

function block_containing_entity(ent, ignoreconf=false){
	if (ent.x%1 != 0 || ent.y%1 != 0 || (!get_config(ent, "inblock") && !ignoreconf)) return false;
	if (!entitydata[ent.id].iscontents) return false;
	b2 = get_tile(ent.x, ent.y, 0);
	if (b2 == null || blockdata[b2] == null) return false;
	return blockdata[b2].hascontents;
}

function draw_objects(){
	for (x = 0; x < blocks.length; x++){
		for (y = 0; y < blocks[x].length; y++){
			id = blocks[x][y];
			if (id == null) continue;
			t = draw_tile(id, x, y, 0, true);
			if (t != null && selectedtiles.length == 0 && placemode > 0 && (nw > tilew || nh > tilew)){
				ctx.fillStyle = "rgba(255, 0, 0, .2)";
				ctx.fillRect(nx, ny, tilew, tilew);
			}
		}
	}
	for (ent of entities){
		t = draw_tile(ent.id, ent.x, ent.y, 1, block_containing_entity(ent), get_config(ent, "direction") == 1 && !entitydata[ent.id].noflip);
	}
}

function get_property(d, name){
	if (d == null) return;
	props = dict_get(d, "props", {});
	return dict_get(props, name, propertydefaults[name]);
}

function get_config(ent, name){
	if (ent == null) return;
	return dict_get((ent.conf == null)?ent:ent.conf, name, dict_get(configdefaults, name, propertydefaults[name]));
}

function set_config(ent, name, val){
	if (ent.conf == null){
		ent[name] = val;
		return;
	}
	ent.conf[name] = val;
	d = entitydata[ent.id];
	cc = d.confconditions;
	if (cc != null){
		for (cond of cc){
			ok = true;
			for (i = 0; i < cond.length; i += 2){
				if (i >= cond.length-1) break;
				if (get_config(ent, cond[i]) != cond[i+1]) ok = false;
			}
			if (ok){
				ent.id = cond[cond.length-1];
				break;
			}
		}
	}
	if (configdefaults[name] == val) delete ent.conf[name];
}

function set_menu(id, page, subpage){
	close_menu_widget();
	if (menu.id == "prefs") save_preferences();
	menu = {id: id, page: page, subpage: subpage};
}

function destroy_block(x, y){
	if (x < 0 || x >= ptblocks.length || y < 0 || y >= ptblocks[x].length) return;
	ptblocks[x][y] = {id: null, bumped: 0};
}

function release_contents(x, y, ply, block=null, d=null, bump=false, top=true){
	if (block == null) block = ptblocks[x][y];
	if (block.id == null || block.contents.length < 1) return false;
	if (d == null) d = blockdata[block.id];
	if (block.contents.length == 1 && bump) ptblocks[x][y].id = get_property(d, "bumpto");
	n = block.contents[0];
	if (get_property(d, "infcontents")){ // cycle contents (put first item at the end)
		ptblocks[x][y].contents.push(ptblocks[x][y].contents.splice(0, 1)[0]);
	} else { // remove contents
		ptblocks[x][y].contents.splice(0, 1);
	}
	if (bump) set_block_bumped(x, y, ply, top);
	spawn_entity_num(n, x, y, ply, top*2-1);
	return true;
}

function release_all_contents(x, y, ply, block=null, d=null){
	if (block == null) block = ptblocks[x][y];
	if (d == null) d = blockdata[block.id];
	xofs = (d.w-tilew)/2, yofs = (d.h-tilew)/2;
	if (block.contents.length < 1) return false;
	for (n of block.contents){
		obj = spawn_entity_num(n, x, y, ply);
		if (obj == null) continue;
		obj.x += xofs, obj.y += yofs;
		obj.drop(ply);
	}
	if (ptblocks[x][y].id != null) ptblocks[x][y].contents = [];
	return true;
}

function point_on_rect(px, py, x, y, w, h){
	px = Math.min(Math.max(px, x), x+w);
	py = Math.min(Math.max(py, y), y+h);
	dl = Math.abs(px-x), dr = Math.abs(px-x-w);
	dt = Math.abs(py-y), db = Math.abs(py-y-h);
	m = Math.min(dl, dr, dt, db);
	if (m == dt) return [px, y];
	if (m == db) return [px, y+h];
	if (m == dl) return [x, py];
	if (m == dr) return [x+w, py];
}

function place_block_at_entity(ent, id, overwrite=null){
	x = Math.floor((ent.x+ent.sprite.w/2)/tilew), y = Math.floor((ent.y+ent.sprite.h/2)/tilew);
	if (get_playtest_tile(x, y, 0).id == overwrite) set_playtest_tile(x, y, {id: id, type: 0});
}

function nearest_player_to(ent){
	ply = null, dist = null;
	for (ent2 of ptentities){
		if (!ent2.is_player) continue;
		dist2 = Math.hypot(ent.x+ent.sprite.w/2-ent2.x-ent2.sprite.w/2, ent.y+ent.sprite.h/2-ent2.y-ent2.sprite.h/2)
		if (dist == null || dist2 < dist) dist = dist2, ply = ent2;
	}
	return ply;
}

function drop_tile_at_entity(ent, tile, ply, round=false){
	if (ply == null) ply = nearest_player_to(ent);
	if (ply == null) return;
	ret = null;
	if (tile.type == 0){
		d = blockdata[tile.id];
		hurts = get_property(d, "hurts");
		if (get_property(d, "onoff") > 0) ret = toggle_onoff(get_property(d, "onoff"), ply);
		else if (hurts == 1 || (hurts == 3 && ply.last_vy > 0) || (hurts == 4 && ply.last_vy < 0) ||
				(hurts == 5 && ply.last_vx < 0) || (hurts == 6 && ply.last_vx > 0)){
			ply.hurt();
			ret = NO_SOUND;
		} else if (tile.id == "finish") finish_level(true);
		else if (get_property(d, "dropplace")) place_block_at_entity(ent, tile.id);
	} else if (tile.type == 1){
		d = entitydata[tile.id];
		x = ent.x/tilew+(ent.sprite.w/tilew-1)/2, y = ent.y/tilew+(ent.sprite.h/tilew-1)/2;
		if (round){
			x = Math.round(x+d.w/2)-d.w/2, y = Math.round(y+d.h/2)-d.h/2;
		}
		obj = spawn_entity({id: tile.id, x: x, y: y, conf: tile.conf});
		obj.facing_left = ent.facing_left;
		obj.drop(ply);
		ret = obj;
	}
	return ret;
}

function drop_contents(ent, ply, clearcontents=true, ...args){
	if (ent.conf.contents == null) return;
	ret = drop_tile_at_entity(ent, ent.conf.contents, ply, ...args);
	if (clearcontents){
		if (ent.conf.contents.type == 1 && ent.link != null && ret.respawn_id != null){
			ptvars.entitystates[ent.link].contents_respawn = ret.respawn_id;
		}
		ent.conf.contents = null;
	}
	return ret;
}

function set_block_bumped(x, y, ply, top=true){
	ptblocks[x][y].bumped = 8;
	ptblocks[x][y].bumpedby = ply;
	if (!top) ptblocks[x][y].bumpeddown = true;
	else delete ptblocks[x][y].bumpeddown;
}

function activate_block(x, y, ply, block=null, top=true){
	if (!ply.can_interact) return;
	if (block == null) block = get_playtest_tile(x, y, 0);
	if (block.id == null) return;
	d = blockdata[block.id];
	if (get_property(d, "bumpto") != null){
		if (block.bumped > 0) return;
		sp = handle_special_activation(ply, block, x, y);
		if (sp == NO_CONTENTS) return;
		if (block.contents.length > 0){ // release contents
			release_contents(x, y, ply, block, null, true, top);
		} else if (get_property(d, "destroyable") == 1 && block.originalcontents.length == 0){ // destroy
			if (!ply.is_player || ply.state > 0){
				ptblocks[x][y] = {id: null};
				set_block_bumped(x, y, ply, top);
				play_sound("break");
				spawn_particle({id: "brickbreak", x: x*tilew, y: y*tilew});
				return NO_SOUND;
			} else {
				set_block_bumped(x, y, ply, top);
				play_sound("bump");
				return NO_SOUND;
			}
		} else { // contents already been released
			ptblocks[x][y].id = get_property(d, "bumpto");
			set_block_bumped(x, y, ply, top);
			if (sp != NO_SOUND) play_sound("bump");
			return NO_SOUND;
		}
	}
}

function remove_invisblocks(invisblocks, x, y, overwrite=false){
	if (invisblocks == null) return;
	for (pos of invisblocks){
		if (overwrite || get_playtest_tile(x+pos[0], y+pos[1], 0).id == "invistile"){
			set_playtest_tile(x+pos[0], y+pos[1], {id: null, type: 0});
		}
	}
}

function handle_special_collision(ply, block, x, y){
	if (block.specialredirect != null){
		[x, y] = block.specialredirect;
		block = get_playtest_tile(x, y, 0);
	}
	id = block.id;
	if (id == null) return;
	if (id == "finish"){
		if (!ply.can_interact) return NO_COLLIDE;
		finish_level(true);
		return COLLIDE_SPECIAL;
	} else if (id == "checkpoint"){
		if (ply.is_player){
			if (ptvars.checkpoint != null){
				set_playtest_tile(ptvars.checkpoint[0], ptvars.checkpoint[1], {id: "checkpoint", type: 0});
			}
			set_playtest_tile(x, y, {id: "checkpointvisited", type: 0});
			ptvars.checkpoint = [x, y, prefs.area];
			release_all_contents(x, y, ply);
			play_sound("checkpoint");
		}
		return NO_COLLIDE;
	} else if (id == "lockedblock" || id == "lockedblocktall" || id == "lockedblockwide"){
		if (!ply.can_interact || ply.get_inventory("key") < 1) return;
		set_playtest_tile(x, y, {id: null, type: 0});
		remove_invisblocks(blockdata[id].invisblocks, x, y);
		release_all_contents(x, y, ply, block);
		ply.add_inventory("key", -1);
		play_sound("unlock");
		return NO_COLLIDE;
	} else if (id == "bridge"){
		release_all_contents(x, y, ply, block);
	}
}

function handle_special_activation(ply, block, x, y){
	d = blockdata[block.id];
	if (get_property(d, "onoff") > 0) return toggle_onoff(get_property(d, "onoff"), ply);
}

function toggle_onoff(v, ply){
	ptvars.onoff[v-1] = !ptvars.onoff[v-1];
	for (x = 0; x < ptblocks.length; x++){
		for (y = 0; y < ptblocks[x].length; y++){
			b = ptblocks[x][y];
			if (b.id == null) continue;
			id = null;
			if (b.id == "onoff"+v) id = "onoff"+v+"_2";
			else if (b.id == "onoff"+v+"_2") id = "onoff"+v;
			else if (b.id == "onblock"+v) id = "onblock"+v+"_2";
			else if (b.id == "onblock"+v+"_2") id = "onblock"+v;
			else if (b.id == "offblock"+v) id = "offblock"+v+"_2";
			else if (b.id == "offblock"+v+"_2") id = "offblock"+v;
			if (id != null){
				set_playtest_tile(x, y, {id: id, type: 0});
				if (id == "offblock"+v) release_all_contents(x, y, ply, b);
			}
		}
	}
	play_sound("onoff");
	return NO_SOUND;
}

function trigger_pswitch(on=true, silent=false){
	cur = ptvars.pswitch > 0;
	if (on){
		ptvars.pswitch = 10*60;
		if (cur){
			if (silent) return;
			play_sound("switch");
			return NO_SOUND;
		}
		for (x = 0; x < ptblocks.length; x++){
			for (y = 0; y < ptblocks[x].length; y++){
				b = ptblocks[x][y];
				if (b.id == "brick" && b.originalcontents.length == 0){
					set_playtest_tile(x, y, {id: null, type: 0});
					obj = spawn_entity({id: "coin", x: x, y: y, conf: {}});
					obj.switch_triggered = 1;
				}
			}
		}
	}
	prev = globaliter;
	for (globaliter = 0; globaliter < ptentities.length; globaliter++){
		ent = ptentities[globaliter];
		if (ent.id == "coin" && ent.fallen == 0 && ent.cutscene.id == null){
			if (on && ent.switch_triggered == 0){
				place_block_at_entity(ent, "brick");
				ent.idle_entity = true;
				ent.switch_triggered = 2;
			} else if (!on && ent.switch_triggered == 1){
				place_block_at_entity(ent, "brick");
				ent.kill();
			} else if (!on && ent.switch_triggered == 2){
				place_block_at_entity(ent, null, "brick");
				ent.idle_entity = false;
				ent.switch_triggered = 0;
			}
		}
	}
	globaliter = prev;
	if (on && !silent){
		play_sound("switch");
		return NO_SOUND;
	}
}

function trigger_pow(activator, airborne=false){
	prev = globaliter;
	for (globaliter = 0; globaliter < ptentities.length; globaliter++){
		ent = ptentities[globaliter];
		if (ent.is_player) continue;
		if (!airborne && ent.air_tick > 0 && ent.weight > 1) continue;
		ent.powwed(activator, airborne);
	}
	globaliter = prev;
	play_sound("pow");
	return NO_SOUND;
}

function check_simple_collision(ent1, ent2){
	// cancel if they are the same entity or either are idle entities
	if (ent1 == ent2 || ent1.idle_entity || ent2.idle_entity) return false;
	// only continue if both are solid or either can interact or either is a projectile
	if ((ent1.remove_entity_collision || ent2.remove_entity_collision) && !ent1.can_interact && !ent2.can_interact
		&& ent1.projectile_type.priority <= 0 && ent2.projectile_type.priority <= 0) return false;
	// cancel if the hitboxes don't intersect
	if (!ent1.collision_hitbox_intersects_entity(ent2)) return false;
	return true;
}

function clamp_scroll(){
	if (scrollx > 0) scrollx = 0;
	if (ptvars.playing && scrollx < -ptvars.levelw+maxw) scrollx = -ptvars.levelw+maxw;
	scrollx = Math.round(scrollx);
	if (scrolly > 0) scrolly = 0;
	if (scrolly < -tilew*areasettings.areah+maxh) scrolly = -tilew*areasettings.areah+maxh;
	scrolly = Math.round(scrolly);
}

function shift_pressed(){
	return keys.includes("ShiftLeft") || keys.includes("ShiftRight");
}

function process_keypresses(){
	if (!ptvars.playing){
		if (menu.id == null){
			m = 20+shift_pressed()*20;
			if (keys.includes("ArrowLeft")) scrollx += m;
			if (keys.includes("ArrowRight")) scrollx -= m;
			if (keys.includes("ArrowUp")) scrolly += m;
			if (keys.includes("ArrowDown")) scrolly -= m;
			clamp_scroll();
		}
	}
}

function get_hovered_tile(){
	return [Math.floor((mousex-scrollx)/tilew), Math.floor((mousey-scrolly)/tilew)];
}

function get_hovered_entity(stop=true){
	ents = [];
	for (i = entities.length-1; i >= 0; i--){
		ent = entities[i];
		if (mousex-scrollx < ent.x*tilew || mousey-scrolly < ent.y*tilew) continue;
		d = entitydata[ent.id];
		nw = d.w, nh = d.h;
		if (block_containing_entity(ent)) nw = tilew, nh = tilew;
		if (mousex-scrollx > ent.x*tilew+nw || mousey-scrolly > ent.y*tilew+nh) continue;
		if (stop) return i;
		else ents.push(i);
	}
	if (ents.length > 0) return ents;
}

function fillbucket_node(x, y, tile, stop){
	if (get_tile(x, y, 0) != stop) return;
	if (tile.id != null && !check_tile_limit(tile, false)) return;
	if (tile.type == 1){
		cur = get_tile(x, y, 1);
		if (cur != null && entities[cur].id == tile.id) return;
	}
	if (!set_tile(x, y, {...tile})) return;
	try {
		fillbucket_node(x-1, y, tile, stop);
		fillbucket_node(x, y+1, tile, stop);
		fillbucket_node(x, y-1, tile, stop);
		fillbucket_node(x+1, y, tile, stop);
	} catch (e){}
}

function check_tile_limit(tile, set=true){
	l = get_sprite_data(tile, false).limit;
	if (l < 1) return true;
	r = 0;
	for (col of blocks){
		r += count_occurences(col, tile.id);
		if (r >= l) break;
	}
	if (r >= l){
		if (l > 1 || !set) return false; // prevent placement of this tile
		for (i = 0; i < col.length; i++){
			if (col[i] == tile.id){
				col[i] = null; // delete existing tile and allow placement
				break;
			}
		}
	}
	return true;
}

function add_selection(t){
	if (t.type == 0){
		for (i = 0; i < selectedtiles.length; i++){
			if (selectedtiles[i].type == 0 && selectedtiles[i].x == t.x && selectedtiles[i].y == t.y){
				selectedtiles.splice(i, 1);
				return;
			}
		}
	} else if (t.type == 1){
		for (i = 0; i < selectedtiles.length; i++){
			if (selectedtiles[i].type == 1 && selectedtiles[i].num == t.num){
				selectedtiles.splice(i, 1);
				return;
			}
		}
	}
	selectedtiles.push(t);
}

function expand_selection(b){
	if (selectionrect == null){
		selectionrect = {...b, processed: true};
		return;
	}
	if (b.x < selectionrect.x){
		diff = b.x-selectionrect.x;
		selectionrect.x += diff, selectionrect.w -= diff;
	}
	if (b.x+b.w > selectionrect.x+selectionrect.w){
		diff = b.x+b.w-selectionrect.x-selectionrect.w;
		selectionrect.w += diff;
	}
	if (b.y < selectionrect.y){
		diff = b.y-selectionrect.y;
		selectionrect.y += diff, selectionrect.h -= diff;
	}
	if (b.y+b.h > selectionrect.y+selectionrect.h){
		diff = b.y+b.h-selectionrect.y-selectionrect.h;
		selectionrect.h += diff;
	}
}

function get_hovered_toolbar(){
	if (prefs.topbarshown && mousey < uidata.top.h) return 1;
	if (!prefs.topbarshown && mousey < uidata.toptab.h){
		if ((mousex >= 5 && mousex <= uidata.toptab.w+5) || (mousex >= maxw-5-uidata.toptab.w && mousex <= maxw-5)) return 1;
	}
	if (prefs.bottombarshown && mousey >= maxh-uidata.bottom.h) return 2;
	if (!prefs.bottombarshown && mousey >= maxh-uidata.bottomtab.h){
		if ((mousex >= 5 && mousex <= uidata.bottomtab.w+5) || (mousex >= maxw-5-uidata.toptab.w && mousex <= maxw-5)) return 2;
	}
	return 0;
}

function process_clicks(){
	if (placemode == 2){
		if (lmdown > 0 && mousex != null && get_hovered_toolbar() == 0 && menu.id == null){
			var mx = Math.round(mousex-scrollx), my = Math.round(mousey-scrolly);
			if (selectionrect == null || lmdown == 1) selectionrect = {x: mx, y: my, w: 0, h: 0};
			else selectionrect.w = mx-selectionrect.x, selectionrect.h = my-selectionrect.y;
		} else if (selectionrect != null && !selectionrect.processed){
			l = selectionrect.x, r = l+selectionrect.w;
			t = selectionrect.y, b = t+selectionrect.h;
			if (l > r) [l, r] = [r, l];
			if (t > b) [t, b] = [b, t];
			if (!shift_pressed()) selectedtiles = [];
			for (n = 0; n < entities.length; n++){
				ent = entities[n];
				if (block_containing_entity(ent)){
					if (!((ent.y+1)*tilew <= t || ent.y*tilew >= b || (ent.x+1)*tilew <= l || ent.x*tilew >= r)){
						add_selection({num: n, type: 1});
					}
				} else {
					d = entitydata[ent.id];
					if (!(ent.y*tilew+d.h <= t || ent.y*tilew >= b || ent.x*tilew+d2.w <= l || ent.x*tilew >= r)){
						add_selection({num: n, type: 1});
					}
				}
			}
			for (x = Math.floor(l/tilew); x <= Math.floor(r/tilew); x++){
				for (y = Math.floor(t/tilew); y <= Math.floor(b/tilew); y++){
					if (get_tile(x, y, 0) == null) continue;
					add_selection({x: x, y: y, type: 0});
				}
			}
			selectionrect = null;
			if (menu.id != "selectionedit") set_menu();
		}
	}
	if (mousex == null) return;
	hover = get_hovered_toolbar();
	if (hover == 1){
		if (reqrelease){
			if (lmdown <= 0) reqrelease = false;
			return;
		}
		if (lmdown == -1 &&
			((prefs.topbarshown && mousey > uidata.top.h-10) ||
			!prefs.topbarshown)){ // toggle top bar
			prefs.topbarshown = !prefs.topbarshown;
			save_preferences();
		}
		return;
	}
	if (hover == 2){
		if (reqrelease){
			if (lmdown <= 0) reqrelease = false;
			return;
		}
		if (lmdown == -1 &&
			((prefs.bottombarshown && mousey <= maxh-uidata.bottom.h+10) ||
			!prefs.bottombarshown)){ // toggle bottom bar
			prefs.bottombarshown = !prefs.bottombarshown;
			save_preferences();
		}
		return;
	}
	if (rmdown == 1){
		if (lmdown == 0 && in_placing_mode(1, -1) && (!in_fullscreen_menu() || menu.id == "entity")){
			ents = get_hovered_entity(false);
			if (ents != null){
				ok = false;
				if (menu.id == "entity"){
					for (n of ents){
						if (n < menu.page){
							ok = true;
							break;
						}
					}
				}
				set_menu("entity", ok?n:ents[0]);
				placemode = -1;
			}
		}
	} else if (mmdown == -1){
		if (dragx == null && (!in_fullscreen_menu() || menu.id == "entity")){
			n = get_hovered_entity();
			if (n == null){
				n = get_tile(...get_hovered_tile(), 0);
				if (n != null) curtile = {id: n, type: 0};
			} else {
				ent = entities[n];
				curtile = {id: ent.id, type: 1, conf: {...ent.conf}};
			}
			if (n != null){
				check_curtile_in_hotbar();
				set_menu();
				clear_placemode();
			}
		}
	}
	if (placemode < 0) return;
	[tilex, tiley] = get_hovered_tile();
	if (in_placing_mode(1) && lmdown > 0 && curtile != null){ // if tile should be placed or erased
		if (placemode != 1){ // if tile should be placed
			if (reqrelease) return;
			ok = true;
			if (placemode == 0 || placemode == 1){
				if (curtile.type == 0){ // check if block limit is exceeded
					ok = check_tile_limit(curtile);
				} else if (curtile.type == 1){
					if (prefs.prevententitystack){ // prevent the same entity being stacked on one tile
						t = get_tile(tilex, tiley, 1);
						if (t != null && entities[t].id == curtile.id) ok = false;
					} else reqrelease = true;
				}
			} else if (lmdown != 1) ok = false;
			if (ok){
				if (placemode == 0){
					set_tile(tilex, tiley, curtile);
					draw_tile(curtile.id, tilex, tiley, curtile.type, curtile.type == 0);
				} else if (placemode == 3){
					stop = get_tile(tilex, tiley, 0);
					if (shift_pressed()){
						fillbucket_node(tilex, tiley, {id: null, type: +(get_hovered_entity() != null)}, stop);
					} else {
						fillbucket_node(tilex, tiley, curtile, stop);
					}
					reqrelease = true;
					clear_placemode();
				}
				if (curtile.hotbarslot == null) check_curtile_in_hotbar(true);
				if (curtile.hotbarslot > 0){ // move tile to front of hotbar
					hotbaritems.splice(curtile.hotbarslot, 1);
					hotbaritems.unshift({...curtile});
				}
				curtile.hotbarslot = 0;
				if (hotbaritems.length > 12) hotbaritems.pop(); // limit hotbar length
			}
		} else { // if tile should be erased
			ok = true;
			if (lmdown == 1 || lmdown > 40){ // erase entity if mouse just pressed or on red eraser mode
				stop = lmdown == 1;
				n = get_hovered_entity(stop);
				if (n != null){
					if (stop) n = [n];
					for (i of n) shift_editor_entity(i, "delete");
					reqrelease = stop;
					ok = reqrelease;
				}
			}
			if (!reqrelease){ // erase block if finished erasing entity
				set_tile(tilex, tiley, {id: null, type: 0});
			}
		}
	} else if (placemode == 0){
		if (rmdown == 0 && mmdown == 0 && curtile != null){
			draw_tile(curtile.id, tilex, tiley, curtile.type, false, false, true);
		}
	} else if (placemode == 4){
		if (lmdown == 1){
			place_multiselect_data(selectedtiles, tilex, tiley);
			if (!shift_pressed()) clear_placemode();
			reqrelease = true;
		} else if (rmdown == 0 && mmdown == 0){
			for (t of selectedtiles){
				draw_tile(t.id, tilex+t.x, tiley+t.y, t.type, false, false, true);
			}
		}
	}
	if (reqrelease){
		if (lmdown > 0) return;
		reqrelease = false;
	}
}

function update(now){
	if (!prefs.framebyframe) requestAnimationFrame(update);
	if (now == null) now = performance.now();
	if (now-refreshtimestamp < 1000/(prefs.fpslimit*1.1)) return;
	ctx.clearRect(0, 0, maxw, maxh);
	process_keypresses();
	if (!ptvars.playing){
		if (menu.id == "tiles") draw_tile_menu(now);
		else {
			draw_grid();
			draw_objects();
			process_clicks();
			draw_ui(now);
		}
	} else {
		update_playtest_objects();
		draw_playtest_objects();
		draw_playtest_ui(now);
	}
	if (lmdown != 0) lmdown++;
	if (rmdown != 0) rmdown++;
	if (mmdown != 0) mmdown++;
	frame++;
}

function init_main(){
	window.addEventListener("keyup", key_up);
	window.addEventListener("keydown", key_down);
	window.addEventListener("wheel", scroll_wheel, {passive: false});
	save_session("clear");
	click_reset_preferences_button();
	load_preferences();
    canvas.style.display = "";
	refreshtimestamp = performance.now();
    requestAnimationFrame(update);
}

resize();
scroll_to_region(3);
window.onload = init_main;
