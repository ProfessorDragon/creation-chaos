const tilew = 64, maxint = 32767;
var maxw = 1600, maxh = 900;
const indexedcategories = [
	{name: "Blocks", color: "blue", tiles: []}, {name: "Items", color: "magenta", tiles: []},
	{name: "Enemies", color: "limegreen", tiles: []}, {name: "Gizmos", color: "yellow", tiles: []}
];
const indexedfonts = ["sans-serif", "monospace", "serif"];
const indexeddynamicblocks = [];
const propertydefaults = {
	destroyable: 0, hurts: 0, surface: 0, onoff: 0, semisolid: 0, conveyorspeed: 0,
	bumpto: null, stepspawn: null, generator: null,
	hidden: false, playerpass: false, entitypass: false, infcontents: false, dropplace: false
};
const configdefaults = {
	direction: 2, speed: 0, type: 0, jump: 0, state: 0, character: 0, size: 1, group: 1, font: 0, colorset: 0, modifier: 0,
	lives: 1,
	inblock: true, revert: true,
	smart: false, progressive: false, vertical: false, invinstar: false, grabbable: true, fast: false, high: false, background: false,
	locked: false, bad: false, instant: false, wearable: false, spikeless: false,
	message: "", name: "", target: ""
};

// block.props properties
//
// destroyable:
// 0 = not destroyable
// 1 = destroyable when bumped and player is big
// 2 = destroyable by bomb
//
// bumpto:
// string containing block which the block will turn into when bumped
// null = cannot be bumped
//
// stepspawn:
// string containing entity which will be spawned when the top of the block is stepped on
// null = will not spawn anything
//
// onoff:
// integer containing on off switch value to be triggered when bumped (minimum 1)
// 0 = no switch will be triggered
//
// hurts:
// integer containing sides which hurt player when collided with
// 0 = does not hurt
// 1 = hurts on all sides
// 2 = instant kill on all sides
// 3 = hurts on all sides except bottom
// 4 = hurts on all sides except top
// 5 = hurts on all sides except right
// 6 = hurts on all sides except left
//
// surface:
// integer containing surface type of block
// 0 = default
// 1 = slippery
// 2 = sticky
//
// semisolid:
// integer containing semisolid side
// 0 = completely solid
// 1 = top semisolid
// 2 = bottom semisolid
// 3 = left semisolid
// 4 = right semisolid
//
// conveyorspeed:
// integer containing the speed of the conveyor
// 0 = not a conveyor
// > 0 = goes right at specified speed multiplier
// < 0 = goes left at specified speed multiplier
//
// generator
// dict containing the generator entity configuration
// e.g. {speed: 1, direction: 0}

// entity.confconditions syntax
//
// array of arrays containing three values
// [[configuration, equals, newentity], ...]
// when configuration == equals the entity will be changed to newentity

const blockdata = {
	// Blocks
	"ground": {x: 2, y: 1, dynamic: 1, collision: null, show: {name: "Ground", tile: "ground_tblr"}, variants: ["ground", "metal"]},
	"ground_tl": {x: 1, y: 0}, // corner
	"ground_t": {x: 2, y: 0}, // line
	"ground_tr": {x: 3, y: 0},
	"ground_l": {x: 1, y: 1},
	"ground_r": {x: 3, y: 1},
	"ground_bl": {x: 1, y: 2},
	"ground_b": {x: 2, y: 2},
	"ground_br": {x: 3, y: 2},
	"ground_tl3": {x: 2.75, y: 4}, // dot
	"ground_tr3": {x: 1.25, y: 4},
	"ground_bl3": {x: 2.75, y: 3},
	"ground_br3": {x: 1.25, y: 3},
	"ground_tl2": {x: 2.75, y: 6},
	"ground_tr2": {x: 1.25, y: 6},
	"ground_bl2": {x: 2.75, y: 5},
	"ground_br2": {x: 1.25, y: 5},
	"ground_t2": {x: 1.25, y: 7}, // cap
	"ground_tb": {x: 1.25, y: 8}, // column
	"ground_b2": {x: 1.25, y: 9},
	"ground_tblr": {x: 2.75, y: 7}, // square
	"ground_l2": {x: 1, y: 10},
	"ground_lr": {x: 2, y: 10},
	"ground_r2": {x: 3, y: 10},
	"ground_2": {x: 2.75, y: 8}, // 4 edge intersection
	
	"metal": {x: 5, y: 1, show: {name: "Metal", tile: "metal_tblr"}, copy: "ground"},
	"metal_tl": {x: 4, y: 0},
	"metal_t": {x: 5, y: 0},
	"metal_tr": {x: 6, y: 0},
	"metal_l": {x: 4, y: 1},
	"metal_r": {x: 6, y: 1},
	"metal_bl": {x: 4, y: 2},
	"metal_b": {x: 5, y: 2},
	"metal_br": {x: 6, y: 2},
	"metal_tl3": {x: 5, y: 4},
	"metal_tr3": {x: 4, y: 4},
	"metal_bl3": {x: 5, y: 3},
	"metal_br3": {x: 4, y: 3},
	"metal_tl2": {x: 5, y: 6},
	"metal_tr2": {x: 4, y: 6},
	"metal_bl2": {x: 5, y: 5},
	"metal_br2": {x: 4, y: 5},
	"metal_t2": {x: 6, y: 4},
	"metal_tb": {x: 6, y: 5},
	"metal_b2": {x: 6, y: 6},
	"metal_tblr": {x: 6, y: 3},
	"metal_l2": {x: 4, y: 7},
	"metal_lr": {x: 5, y: 7},
	"metal_r2": {x: 6, y: 7},
	"metal_t3": {x: 4, y: 8}, // 3 edge intersection
	"metal_r3": {x: 5, y: 8},
	"metal_b3": {x: 5, y: 9},
	"metal_l3": {x: 4, y: 9},
	"metal_2": {x: 2.75, y: 9},
	
	"brick": {x: 0, y: 3, show: {name: "Brick"}, props: {destroyable: 1, bumpto: "hitblock"},
		variants: ["brick", "question", "infquestion", "hidden"]},
	"question": {x: 0, y: 1, show: {name: "Mystery Block"}, props: {bumpto: "hitblock"}, copy: "brick"},
	"infquestion": {x: 0, y: 9, show: {name: "Infinity Block"}, props: {bumpto: "infquestion", infcontents: true}, copy: "brick"},
	"hidden": {x: 0, y: 4, show: {name: "Hidden Block"}, props: {bumpto: "hitblock", hidden: true}, copy: "brick"},
	"hitblock": {x: 0, y: 2, show: {name: "Indestructable Block"}},
	"hardblock": {x: 0, y: 0, show: {name: "Hard Block"}, props: {destroyable: 2}},
	
	"pipetop": {x: 21, y: 1, w: 2, dynamic: 3, show: {name: "Pipe", tile: "pipetop_4x4", curtile: "pipetop_t"}, invisblocks: [[1, 0]],
		variants: ["pipetop", "piperight", "pipebottom", "pipeleft"]},
	"pipetop_t": {x: 21, y: 0, show: {hidden: true}, props: {generator: {speed: 1, direction: 0}}, copy: "pipetop"},
	"pipetop_tb": {copy: "pipetop_t"},
	"pipetop_4x4": {x: 21, y: 0, w: 2, h: 2},
	"piperight": {x: 24, y: 0, w: 1, h: 2, dynamic: 2, show: {name: "Pipe", tile: "piperight_4x4", curtile: "piperight_r", hidden: true},
		invisblocks: [[0, 1]], collision: undefined, copy: "pipetop"},
	"piperight_r": {x: 25, y: 0, show: {hidden: true}, props: {generator: {speed: 1, direction: 1}}, copy: "piperight"},
	"piperight_lr": {copy: "piperight_r"},
	"piperight_4x4": {x: 24, y: 0, w: 2, h: 2},
	"pipebottom": {x: 21, y: 1, show: {name: "Pipe", tile: "pipebottom_4x4", curtile: "pipebottom_b", hidden: true}, copy: "pipetop"},
	"pipebottom_b": {x: 21, y: 2, show: {hidden: true}, props: {generator: {speed: 1, direction: 2}}, copy: "pipebottom"},
	"pipebottom_tb": {copy: "pipebottom_b"},
	"pipebottom_4x4": {x: 21, y: 1, w: 2, h: 2},
	"pipeleft": {x: 24, y: 0, show: {name: "Pipe", tile: "pipeleft_4x4", curtile: "pipeleft_l", hidden: true}, copy: "piperight"},
	"pipeleft_l": {x: 23, y: 0, show: {hidden: true}, props: {generator: {speed: 1, direction: 3}}, copy: "pipeleft"},
	"pipeleft_lr": {copy: "pipeleft_l"},
	"pipeleft_4x4": {x: 23, y: 0, w: 2, h: 2},
	
	"smallpipetop": {x: 25, y: 4, dynamic: 3, show: {name: "Small Pipe", tile: "smallpipetop_t"},
		variants: ["smallpipetop", "smallpiperight", "smallpipebottom", "smallpipeleft"]},
	"smallpipetop_t": {x: 25, y: 3, show: {hidden: true}, props: {generator: {speed: 1, direction: 0}}, copy: "smallpipetop"},
	"smallpipetop_tb": {copy: "smallpipetop_t"},
	"smallpiperight": {x: 24, y: 2, dynamic: 2, show: {name: "Small Pipe", tile: "smallpiperight_r", hidden: true}, copy: "smallpipetop"},
	"smallpiperight_r": {x: 25, y: 2, show: {hidden: true}, props: {generator: {speed: 1, direction: 1}}, copy: "smallpiperight"},
	"smallpiperight_lr": {copy: "smallpiperight_r"},
	"smallpipebottom": {x: 25, y: 4, show: {name: "Small Pipe", tile: "smallpipebottom_b", hidden: true}, copy: "smallpipetop"},
	"smallpipebottom_b": {x: 25, y: 5, show: {hidden: true}, props: {generator: {speed: 1, direction: 2}}, copy: "smallpipebottom"},
	"smallpipebottom_tb": {copy: "smallpipebottom_b"},
	"smallpipeleft": {x: 24, y: 2, show: {name: "Small Pipe", tile: "smallpipeleft_l", hidden: true}, copy: "smallpiperight"},
	"smallpipeleft_l": {x: 23, y: 2, show: {hidden: true}, props: {generator: {speed: 1, direction: 3}}, copy: "smallpipeleft"},
	"smallpipeleft_lr": {copy: "smallpipeleft_l"},
	
	"bridge": {x: 0, y: 10, show: {name: "Bridge"}, props: {semisolid: 1}},
	"slabright": {x: 0, y: 12, collision: [.5, 0, .5, 1], show: {name: "Half-Block"}, props: {destroyable: 2},
		variants: ["slabright", "slabbottom", "slableft", "slabtop"]},
	"slabbottom": {x: 3, y: 12, collision: [0, .5, 1, .5], show: {name: "Half-Block", hidden: true}, copy: "slabright"},
	"slableft": {x: 1, y: 12, collision: [0, 0, .5, 1], copy: "slabbottom"},
	"slabtop": {x: 2, y: 12, collision: [0, 0, 1, .5], copy: "slabbottom"},
	"ice": {x: 0, y: 8, show: {name: "Ice"}, props: {destroyable: 2, surface: 1}, variants: ["ice", "slime", "magma"]},
	"slime": {x: 0, y: 6, show: {name: "Slime"}, props: {destroyable: 2, surface: 2}, copy: "ice"},
	"magma": {x: 0, y: 11, show: {name: "Magma"}, props: {destroyable: 2, surface: 3}, copy: "ice"},
	"fallingblock": {x: 0, y: 7, hascontents: false, show: {name: "Falling Block"}, props: {stepspawn: "fallingblock"},
		variants: ["fallingblock", "sand"]},
	"sand": {x: 0, y: 5, show: {name: "Sand Platform"}, props: {semisolid: 1, stepspawn: "fallingsand"}, copy: "fallingblock"},
	"spiketrap": {x: 13, y: 0, frames: 2, framespeed: 16, show: {name: "Spike Trap"}, props: {hurts: 1},
		variants: ["spiketrap", "skullspiketrap"]},
	"skullspiketrap": {x: 15, y: 0, frames: 2, framespeed: 16, show: {name: "Deadly Spike Trap"}, props: {hurts: 2}, copy: "spiketrap"},
	"cone": {x: 11, y: 0, collision: [.2, 0, .6, 1], show: {name: "Cone Spike"}, props: {hurts: 3},
		variants: ["cone", "coneright", "cone2", "coneleft"]},
	"cone2": {x: 12, y: 0, collision: [.2, 0, .6, 1], show: {name: "Cone Spike", hidden: true}, props: {hurts: 4}, copy: "cone"},
	"coneleft": {x: 17, y: 0, collision: [0, .2, 1, .6], show: {name: "Cone Spike", hidden: true}, props: {hurts: 5}, copy: "cone"},
	"coneright": {x: 18, y: 0, props: {hurts: 6}, copy: "coneleft"},
	
	"playerblock": {x: 12, y: 1, show: {name: "Player Block"}, props: {entitypass: true},
		variants: ["playerblock", "playersemisolid", "playerspikes", "entityblock", "entitysemisolid", "entityspikes"]},
	"playersemisolid": {x: 13, y: 1, show: {name: "Player Semisolid"}, props: {entitypass: true, semisolid: 1}, copy: "playerblock"},
	"playerspikes": {x: 14, y: 1, show: {name: "Player Spike Trap"}, props: {entitypass: true, hurts: 1}, copy: "playerblock"},
	"entityblock": {x: 12, y: 2, show: {name: "Entity Block"}, props: {playerpass: true}, copy: "playerblock"},
	"entitysemisolid": {x: 13, y: 2, show: {name: "Entity Semisolid"},
		props: {playerpass: true, semisolid: 1}, copy: "playerblock"},
	"entityspikes": {x: 14, y: 2, show: {name: "Entity Spike Trap"},
		props: {playerpass: true, hurts: 2}, copy: "playerblock"},
	"customblock": {x: 12, y: 3},
	"customsemisolid": {x: 13, y: 3},
	"customspikes": {x: 14, y: 3},
	
	"onoff1": {x: 7, y: 0, show: {name: "On/Off Switch"}, props: {bumpto: "onoff1_2", onoff: 1},
		variants: ["onoff1", "onoff2", "onoff3", "onoff4"]},
	"onoff1_2": {x: 7, y: 1, props: {bumpto: "onoff1", onoff: 1}},
	"onblock1": {x: 7, y: 2, show: {name: "On Block"}, variants: ["onblock1", "onblock2", "onblock3", "onblock4"]},
	"onblock1_2": {x: 7, y: 3, collision: null},
	"offblock1": {x: 7, y: 4, collision: null, show: {name: "Off Block"},
		variants: ["offblock1", "offblock2", "offblock3", "offblock4"]},
	"offblock1_2": {x: 7, y: 5},
	"onoff2": {x: 8, y: 0, show: {name: "On/Off Switch", hidden: true}, props: {bumpto: "onoff2_2", onoff: 2},
		copy: "onoff1"},
	"onoff2_2": {x: 8, y: 1, props: {bumpto: "onoff2", onoff: 2}},
	"onblock2": {x: 8, y: 2, show: {name: "On Block", hidden: true}, copy: "onblock1"},
	"onblock2_2": {x: 8, y: 3, collision: null},
	"offblock2": {x: 8, y: 4, collision: null, show: {name: "Off Block", hidden: true}, copy: "offblock1"},
	"offblock2_2": {x: 8, y: 5},
	"onoff3": {x: 9, y: 0, props: {bumpto: "onoff3_2", onoff: 3}, copy: "onoff2"},
	"onoff3_2": {x: 9, y: 1, props: {bumpto: "onoff3", onoff: 3}},
	"onblock3": {x: 9, y: 2, copy: "onblock2"},
	"onblock3_2": {x: 9, y: 3, collision: null},
	"offblock3": {x: 9, y: 4, copy: "offblock2"},
	"offblock3_2": {x: 9, y: 5},
	"onoff4": {x: 10, y: 0, props: {bumpto: "onoff4_2", onoff: 4}, copy: "onoff2"},
	"onoff4_2": {x: 10, y: 1, props: {bumpto: "onoff4", onoff: 4}},
	"onblock4": {x: 10, y: 2, copy: "onblock3"},
	"onblock4_2": {x: 10, y: 3, collision: null},
	"offblock4": {x: 10, y: 4, copy: "offblock3"},
	"offblock4_2": {x: 10, y: 5},

	"celtic": {x: 15, y: 9, show: {name: "Celtic Knot Block", tile: "celtic_2"}},
	"celtic_tl": {x: 14, y: 8},
	"celtic_t": {x: 15, y: 8},
	"celtic_tr": {x: 16, y: 8},
	"celtic_l": {x: 14, y: 9},
	"celtic_r": {x: 16, y: 9},
	"celtic_bl": {x: 14, y: 10},
	"celtic_b": {x: 15, y: 10},
	"celtic_br": {x: 16, y: 10},
	"celtic_tl3": {x: 14, y: 11.25},
	"celtic_tr3": {x: 15, y: 11.25},
	"celtic_bl3": {x: 14, y: 12.25},
	"celtic_br3": {x: 15, y: 12.25},
	"celtic_tl2": {x: 19, y: 10},
	"celtic_tr2": {x: 17, y: 10},
	"celtic_bl2": {x: 19, y: 8},
	"celtic_br2": {x: 17, y: 8},
	"celtic_t2": {x: 21, y: 8},
	"celtic_tb": {x: 17, y: 9},
	"celtic_b2": {x: 21, y: 10},
	"celtic_tblr": {x: 18, y: 9},
	"celtic_l2": {x: 20, y: 9},
	"celtic_lr": {x: 18, y: 8},
	"celtic_r2": {x: 22, y: 9},
	"celtic_t3": {x: 16.25, y: 12.5},
	"celtic_r3": {x: 17.5, y: 11.25},
	"celtic_b3": {x: 17.5, y: 12.5},
	"celtic_l3": {x: 16.25, y: 11.25},
	"celtic_2": {x: 21, y: 9},

	"redcolor": {x: 7, y: 6, collision: null, show: {name: "Colored Tile"},
		variants: ["redcolor", "orangecolor", "yellowcolor", "limecolor", "bluecolor", "aquacolor", "purplecolor",
		"magentacolor", "browncolor", "whitecolor", "graycolor", "blackcolor"], props: {dropplace: true}},
	"orangecolor": {x: 7, y: 7, show: {name: "Colored Tile", hidden: true}, copy: "redcolor"},
	"yellowcolor": {x: 7, y: 8, copy: "orangecolor"},
	"limecolor": {x: 8, y: 8, copy: "orangecolor"},
	"bluecolor": {x: 9, y: 8, copy: "orangecolor"},
	"aquacolor": {x: 9, y: 7, copy: "orangecolor"},
	"purplecolor": {x: 9, y: 6, copy: "orangecolor"},
	"magentacolor": {x: 8, y: 6, copy: "orangecolor"},
	"browncolor": {x: 8, y: 7, copy: "orangecolor"},
	"whitecolor": {x: 10, y: 6, copy: "orangecolor"},
	"graycolor": {x: 10, y: 7, copy: "orangecolor"},
	"blackcolor": {x: 10, y: 8, copy: "orangecolor"},
	
	"bush": {x: 6, y: 10, collision: null, show: {name: "Bush"}, variants: ["bush", "largebush"]},
	"largebush": {x: 7, y: 9, w: 2, show: {name: "Bush", hidden: true}, copy: "bush"},
	"tree": {x: 7, y: 10, w: 3, h: 4, collision: null, show: {name: "Tree"}},
	"blueflower": {x: 11, y: 8, h: 2, collision: null, show: {name: "Flower"}, variants: ["blueflower", "whiteflower", "redflower"]},
	"whiteflower": {x: 12, y: 8, show: {name: "Flower", hidden: true}, copy: "blueflower"},
	"redflower": {x: 13, y: 8, copy: "whiteflower"},
	"cloud": {x: 9, y: 9, w: 2, collision: null, show: {name: "Cloud"}},
	
	// Gizmos
	"start": {x: 6, y: 8, limit: 1, collision: null, show: {name: "Start Flag", category: 3}, variants: ["start", "checkpoint", "finish"]},
	"finish": {x: 6, y: 9, limit: 0, collision: [.1, .1, .8, .8], hascontents: false, show: {name: "Finish Flag", category: 3},
		copy: "start"},
	"checkpoint": {x: 4, y: 10, hascontents: true, show: {name: "Checkpoint Flag", category: 3}, copy: "finish"},
	"checkpointvisited": {x: 5, y: 10, collision: null},
	"onewayright": {x: 11, y: 4, frames: 4, framespeed: 8, show: {name: "One-Way Wall", category: 3}, props: {semisolid: 4},
		variants: ["onewayright", "onewaybottom", "onewayleft", "onewaytop"], hascontents: false},
	"onewaybottom": {x: 11, y: 7, show: {name: "One-Way Wall", category: 3, hidden: true}, props: {semisolid: 2}, copy: "onewayright"},
	"onewayleft": {x: 11, y: 5, props: {semisolid: 3}, copy: "onewaybottom"},
	"onewaytop": {x: 11, y: 6, props: {semisolid: 1}, copy: "onewaybottom"},
	
	"conveyor": {x: 19, y: 1, hascontents: false, dynamic: 2, show: {name: "Conveyor", category: 3}, props: {conveyorspeed: 1},
		variants: ["superconveyor2", "fastconveyor2", "conveyor2", "slowconveyor2", "slowconveyor", "conveyor", "fastconveyor", "superconveyor"],
		playtestalt: "conveyorblock"},
	"conveyor_l": {x: 18, y: 1},
	"conveyor_r": {x: 20, y: 1},
	"conveyorblock": {x: 15, y: 5, frames: 6, framespeed: 1, show: {name: "Conveyor", category: 3, hidden: true}, copy: "conveyor"},
	"conveyorblock_l": {x: 15, y: 6, copy: "conveyorblock"},
	"conveyorblock_r": {x: 15, y: 7, copy: "conveyorblock"},
	"slowconveyor": {x: 16, y: 1, show: {name: "Slow Conveyor", category: 3, hidden: true}, props: {conveyorspeed: .5},
		copy: "conveyor", playtestalt: "slowconveyorblock"},
	"slowconveyor_l": {x: 15, y: 1},
	"slowconveyor_r": {x: 17, y: 1},
	"slowconveyorblock": {x: 15, y: 5, frames: 6, framespeed: 1/.5, copy: "slowconveyor"},
	"slowconveyorblock_l": {x: 15, y: 6, copy: "slowconveyorblock"},
	"slowconveyorblock_r": {x: 15, y: 7, copy: "slowconveyorblock"},
	"fastconveyor": {x: 16, y: 2, show: {name: "Fast Conveyor", category: 3, hidden: true}, props: {conveyorspeed: 2},
		copy: "conveyor", playtestalt: "fastconveyorblock"},
	"fastconveyor_l": {x: 15, y: 2},
	"fastconveyor_r": {x: 17, y: 2},
	"fastconveyorblock": {x: 15, y: 5, frames: 6, framespeed: 1/2, copy: "fastconveyor"},
	"fastconveyorblock_l": {x: 15, y: 6, copy: "fastconveyorblock"},
	"fastconveyorblock_r": {x: 15, y: 7, copy: "fastconveyorblock"},
	"superconveyor": {x: 19, y: 2, show: {name: "Super Conveyor", category: 3, hidden: true}, props: {conveyorspeed: 4},
		copy: "conveyor", playtestalt: "superconveyorblock"},
	"superconveyor_l": {x: 18, y: 2},
	"superconveyor_r": {x: 20, y: 2},
	"superconveyorblock": {x: 15, y: 5, frames: 6, framespeed: 1/4, copy: "superconveyor"},
	"superconveyorblock_l": {x: 15, y: 6, copy: "superconveyorblock"},
	"superconveyorblock_r": {x: 15, y: 7, copy: "superconveyorblock"},
	"conveyor2": {x: 19, y: 3, show: {name: "Conveyor", category: 3, hidden: true}, props: {conveyorspeed: -1},
		copy: "conveyor", playtestalt: "conveyorblock2"},
	"conveyor2_l": {x: 18, y: 3},
	"conveyor2_r": {x: 20, y: 3},
	"conveyorblock2": {x: 20, y: 5, frames: 6, framespeed: -1, copy: "conveyor2"},
	"conveyorblock2_l": {x: 20, y: 6, copy: "conveyorblock2"},
	"conveyorblock2_r": {x: 20, y: 7, copy: "conveyorblock2"},
	"slowconveyor2": {x: 16, y: 3, copy: "slowconveyor", props: {conveyorspeed: -.5}, playtestalt: "slowconveyorblock2"},
	"slowconveyor2_l": {x: 15, y: 3},
	"slowconveyor2_r": {x: 17, y: 3},
	"slowconveyorblock2": {x: 20, y: 5, frames: 6, framespeed: 1/-.5, copy: "slowconveyor2"},
	"slowconveyorblock2_l": {x: 20, y: 6, copy: "slowconveyorblock2"},
	"slowconveyorblock2_r": {x: 20, y: 7, copy: "slowconveyorblock2"},
	"fastconveyor2": {x: 16, y: 4, copy: "fastconveyor", props: {conveyorspeed: -2}, playtestalt: "fastconveyorblock2"},
	"fastconveyor2_l": {x: 15, y: 4},
	"fastconveyor2_r": {x: 17, y: 4},
	"fastconveyorblock2": {x: 20, y: 5, frames: 6, framespeed: 1/-2, copy: "fastconveyor2"},
	"fastconveyorblock2_l": {x: 20, y: 6, copy: "fastconveyorblock2"},
	"fastconveyorblock2_r": {x: 20, y: 7, copy: "fastconveyorblock2"},
	"superconveyor2": {x: 19, y: 4, copy: "superconveyor", props: {conveyorspeed: -4}, playtestalt: "superconveyorblock2"},
	"superconveyor2_l": {x: 18, y: 4},
	"superconveyor2_r": {x: 20, y: 4},
	"superconveyorblock2": {x: 20, y: 5, frames: 6, framespeed: 1/-4, copy: "superconveyor2"},
	"superconveyorblock2_l": {x: 20, y: 6, copy: "superconveyorblock2"},
	"superconveyorblock2_r": {x: 20, y: 7, copy: "superconveyorblock2"},
	
	"lockedblock": {x: 11, y: 1, show: {name: "Locked Block", category: 3}, variants: ["lockedblock", "lockedblocktall", "lockedblockwide"]},
	"lockedblocktall": {x: 11, y: 2, h: 2, show: {name: "Tall Locked Block", category: 3, hidden: true},
		invisblocks: [[0, 1]], copy: "lockedblock"},
	"lockedblockwide": {x: 1, y: 11, w: 3, show: {name: "Wide Locked Block", category: 3, hidden: true},
		invisblocks: [[1, 0], [2, 0]], copy: "lockedblock"},
	
	// Extras
	"invistile": {x: 0, y: 0, w: 0, h: 0, hascontents: false, collision: [0, 0, 1, 1]},
	"air": {x: 0, y: 0, w: 0, h: 0, collision: null},
	"missing": {x: 4, y: 11}
};

const entitydata = {
	// Items
	"coin": {x: 18, y: 4, frames: 6, framespeed: 6, show: {name: "Coin", category: 1}, class: Collectable,
		menu: MenuPresets.collectable, animations: {"inventory": {x: 10, y: 1}}, variants: ["coin", "timedcoin"]},
	"coin10": {x: 6, y: 0, w: 2, h: 2, frames: 1, show: {name: "10-Coin", category: 1}, class: LargeCollectable, menu: MenuPresets.large_coin,
		confconditions: [["type", 0, "coin10"], ["type", 1, "coin30"], ["type", 2, "coin50"], ["type", -1, "starcoin"]],
		variants: ["coin10", "coin30", "coin50", "starcoin"]},
	"coin30": {x: 14, y: 0, show: {name: "30-Coin", category: 1, hidden: true}, copy: "coin10", conf: {type: 1}},
	"coin50": {x: 22, y: 1, show: {name: "50-Coin", category: 1, hidden: true}, copy: "coin10", conf: {type: 2}},
	"starcoin": {x: 14, y: 2, show: {name: "Star Coin", category: 1, hidden: true}, copy: "coin10", conf: {type: -1},
		animations: {"inventory": {x: 10.5, y: 1}}},
	"timedcoin": {x: 18, y: 5, show: {name: "Blue Coin", category: 1}, copy: "coin", class: TimedCoin, conf: {modifier: 2}},
	
	"mushroom": {x: 10, y: 0, show: {name: "Super Mushroom", category: 1}, class: Powerup, menu: MenuPresets.powerup,
		conf: {type: 1, speed: 3, revert: false}, variants: ["mushroom", "flower"]},
	"flower": {x: 11, y: 0, show: {name: "Fire Flower", category: 1}, conf: {type: 2}, copy: "mushroom"},
	"extralife": {x: 7, y: 13, show: {name: "Bonus Mushroom", category: 1}, class: LifeMushroom, menu: MenuPresets.powerup, conf: {speed: 3},
		animations: {"inventory": {x: 10, y: 1.5}}},
	"invinstar": {x: 16, y: 3, show: {name: "Invincibility Star", category: 1}, class: InvincibilityStar, menu: MenuPresets.powerup,
		conf: {speed: 3, jump: -13}},
	"cherry": {x: 9, y: 1, show: {name: "Double Cherry", category: 1}, class: DoubleCherry, menu: MenuPresets.powerup},
	
	// Enemies
	"wanderer": {x: 23, y: 3, frames: 2, framespeed: 16, show: {name: "Wanderer"}, class: StompableEnemy, menu: MenuPresets.walking_enemy},
	"foppy": {x: 4, y: 0, frames: 2, framespeed: 16, show: {name: "Foppy"}, class: Foppy, menu: MenuPresets.walking_enemy,
		confconditions: [["smart", true, "fobby"], ["smart", false, "foppy"]]},
	"fobby": {x: 12, y: 0, show: {name: "Fobby", hidden: true}, copy: "foppy", conf: {smart: true}},
    "blockhead": {x: 0, y: 0, frames: 2, framespeed: 16, show: {name: "Blockhead"}, class: BlockHead, menu: MenuPresets.walking_enemy},
	"birb": {x: 0, y: 1, frames: 6, show: {name: "Bird"}, class: Bird, menu: MenuPresets.flip_contents,
		animations: {"warn": {x: 9, y: 0}}},
	"buzzy": {x: 16, y: 19, frames: 2, framespeed: 8, show: {name: "Beetle"}, class: Buzzy, menu: MenuPresets.walking_enemy,
		variants: ["buzzy", "buzzyshell", "spiny", "spinyshell"]},
	"buzzyshell": {x: 18, y: 19, frames: 1, framespeed: 4, show: {name: "Beetle Shell", hidden: true}, class: Shell, menu: MenuPresets.shell,
		copy: "buzzy"},
	"spiny": {x: 16, y: 0, frames: 4, framespeed: 8, show: {name: "Flamin' Spiny"}, class: Spiny, copy: "buzzy"},
	"spinyshell": {x: 18, y: 18, frames: 1, framespeed: 4, show: {name: "Spiny Shell", hidden: true}, conf: {type: 1},
		copy: "buzzyshell"},
	"skipper": {x: 16, y: 10, show: {name: "Skipper"}, class: Skipper, menu: MenuPresets.jumping_enemy,
		animations: {"jump": {x: 17, y: 10, frames: 7, loop: false}}, confconditions: [["fast", false, "skipper"], ["fast", true, "madskipper"]]},
	"madskipper": {x: 16, y: 11, show: {name: "Mad Skipper", hidden: true}, copy: "skipper",
		animations: {"jump": {x: 17, y: 11, frames: 7, loop: false}}, conf: {fast: true}},
	"muncher": {x: 20, y: 0, frames: 2, framespeed: 16, show: {name: "Muncher"}, class: Muncher, menu: MenuPresets.nogravity_contents},
	"spikecrusher": {x: 17, y: 22, w: 2, h: 2, show: {name: "Crusher"}, class: Crusher, menu: MenuPresets.crusher,
		variants: ["spikecrusher", "crusher", "madspikecrusher", "madcrusher"], conf: {direction: 2}, confconditions: [
			["spikeless", false, "fast", false, "spikecrusher"], ["spikeless", true, "fast", false, "crusher"],
			["spikeless", false, "fast", true, "madspikecrusher"], ["spikeless", true, "fast", true, "madcrusher"]
		], animations: {"angry": {x: 21, y: 22, w: 2, h: 2}}},
	"crusher": {x: 19, y: 22, show: {name: "Spikeless Crusher", hidden: true}, copy: "spikecrusher", conf: {direction: 2, spikeless: true},
		animations: {"angry": {x: 23, y: 22, w: 2, h: 2}}},
	"madspikecrusher": {x: 17, y: 24, show: {name: "Mad Crusher", hidden: true}, copy: "spikecrusher", conf: {direction: 2, fast: true},
		animations: {"angry": {x: 21, y: 24, w: 2, h: 2}}},
	"madcrusher": {x: 19, y: 24, show: {name: "Mad Spikeless Crusher", hidden: true}, copy: "spikecrusher",
		conf: {direction: 2, spikeless: true, fast: true}, animations: {"angry": {x: 23, y: 24, w: 2, h: 2}}},
	"trex": {x: 16, y: 18, show: {name: "T-Rex", hidden: true}, class: StompableEnemy, menu: MenuPresets.flip_contents},
	
	// Gizmos
	"player": {x: 5, y: 8, show: {name: "Player", category: 3, index: 3}, class: Player, menu: MenuPresets.player, animations: {
		"0_0_walk": {x: 0, y: 6, h: 1.5, frames: 6},
		"0_0_jump": {x: 0, y: 7.5, h: 1.5, frames: 2, loop: false},
		"0_0_fall": {x: 2, y: 7.5, h: 1.5, frames: 2, loop: false},
		"0_0_crouch": {x: 4, y: 7.5, h: 1.5, frames: 2, loop: false},
		"0_0_back": {x: 6, y: 6, h: 1.5},
		"0_1_walk": {x: 0, y: 2, h: 2, frames: 8},
		"0_1_jump": {x: 0, y: 4, h: 2, frames: 4, loop: false},
		"0_1_fall": {x: 4, y: 4, h: 2, frames: 2, loop: false},
		"0_1_crouch": {x: 6, y: 4, h: 2, frames: 2, loop: false},
		"0_1_back": {x: 5, y: 13, h: 2},
		"0_2_walk": {x: 0, y: 9, h: 2, frames: 8},
		"0_2_jump": {x: 0, y: 11, h: 2, frames: 4, loop: false},
		"0_2_fall": {x: 4, y: 11, h: 2, frames: 2, loop: false},
		"0_2_crouch": {x: 6, y: 11, h: 2, frames: 2, loop: false},
		"0_2_back": {x: 4, y: 13, h: 2},
		"0_2_fireball": {x: 0, y: 13, h: 2, frames: 2, setstart: true},
		"0_2_fireball_jump": {x: 2, y: 13, h: 2, frames: 2},
		"1_0_walk": {x: 8, y: 6, h: 1.5, frames: 4, loop: false},
		"1_0_jump": {x: 8, y: 7.5, h: 1.5, frames: 4, loop: false},
		"1_0_fall": {x: 12, y: 7.5, h: 1.5, frames: 4, loop: false},
		"1_0_crouch": {x: 12, y: 6, h: 1.5, frames: 2, loop: false},
		"1_0_back": {x: 7, y: 6, h: 1.5},
		"1_1_walk": {x: 8, y: 2, h: 2, frames: 4, loop: false},
		"1_1_jump": {x: 8, y: 4, h: 2, frames: 4, loop: false},
		"1_1_fall": {x: 12, y: 4, h: 2, frames: 4, loop: false},
		"1_1_crouch": {x: 12, y: 2, h: 2, frames: 2, loop: false},
		"1_1_back": {x: 15, y: 9, h: 2},
		"1_2_walk": {x: 8, y: 9, h: 2, frames: 4, loop: false},
		"1_2_jump": {x: 8, y: 11, h: 2, frames: 4, loop: false},
		"1_2_fall": {x: 12, y: 11, h: 2, frames: 4, loop: false},
		"1_2_crouch": {x: 12, y: 9, h: 2, frames: 2, loop: false},
		"1_2_back": {x: 14, y: 9, h: 2},
		"1_2_fireball": {x: 8, y: 13, h: 2, frames: 2, setstart: true},
		"1_2_fireball_walk": {x: 10, y: 13, h: 2, frames: 2},
		"1_2_fireball_jump": {x: 12, y: 13, h: 2, frames: 2},
		"1_2_fireball_fall": {x: 14, y: 13, h: 2, frames: 2}
	}},
	
	"key": {x: 3, y: 0, show: {name: "Key", category: 3}, class: Key, menu: MenuPresets.key, variants: ["key", "badkey"],
		confconditions: [["bad", false, "key"], ["bad", true, "badkey"]]},
	"badkey": {x: 2, y: 0, show: {name: "Cursed Key", category: 3, hidden: true}, copy: "key", conf: {bad: true}},
	"keycoin1": {x: 18, y: 6, frames: 6, framespeed: 6, show: {name: "Key Coin", category: 3}, class: KeyCoin, menu: MenuPresets.key_coin,
		confconditions: [["group", 1, "keycoin1"], ["group", 2, "keycoin2"], ["group", 3, "keycoin3"], ["group", 4, "keycoin4"]],
		animations: {"inventory": {x: 22, y: 3}}, variants: ["keycoin1", "keycoin2", "keycoin3", "keycoin4"], copy: "key"},
	"keycoin2": {x: 18, y: 7, show: {name: "Key Coin", category: 3, hidden: true}, copy: "keycoin1", conf: {group: 2},
		animations: {"inventory": {x: 22.5, y: 3}}},
	"keycoin3": {x: 18, y: 8, copy: "keycoin2", conf: {group: 3}, animations: {"inventory": {x: 22, y: 3.5}}},
	"keycoin4": {x: 18, y: 9, copy: "keycoin2", conf: {group: 4}, animations: {"inventory": {x: 22.5, y: 3.5}}},
	
	"pipewarptop": {x: 16, y: 20, w: 2, show: {name: "Pipe Warp", category: 3}, class: PipeWarp, menu: MenuPresets.pipe_warp,
		extralines: 3, iscontents: false, variants: ["pipewarptop", "pipewarpleft", "pipewarpbottom", "pipewarpright"], confconditions: [
			["direction", 0, "size", 1, "pipewarpbottom"], ["direction", 1, "size", 1, "pipewarpright"],
			["direction", 2, "size", 1, "pipewarptop"], ["direction", 3, "size", 1, "pipewarpleft"],
			["direction", 0, "size", 0, "smallpipewarpbottom"], ["direction", 1, "size", 0, "smallpipewarpright"],
			["direction", 2, "size", 0, "smallpipewarptop"], ["direction", 3, "size", 0, "smallpipewarpleft"],
		], conf: {direction: 2}},
	"pipewarpbottom": {x: 18, y: 20, show: {name: "Pipe Warp", category: 3, hidden: true}, copy: "pipewarptop", conf: {direction: 0}},
	"pipewarpright": {x: 20, y: 20, w: 1, h: 2, copy: "pipewarpbottom", conf: {direction: 1}, noflip: true},
	"pipewarpleft": {x: 21, y: 20, copy: "pipewarpright", conf: {direction: 3}},
	"smallpipewarptop": {x: 16, y: 21, w: 1, show: {name: "Small Pipe Warp", category: 3, hidden: true}, copy: "pipewarptop",
		variants: ["smallpipewarptop", "smallpipewarpleft", "smallpipewarpbottom", "smallpipewarpright"], conf: {direction: 2, size: 0}},
	"smallpipewarpbottom": {x: 17, y: 21, copy: "smallpipewarptop", conf: {direction: 0, size: 0}},
	"smallpipewarpright": {x: 18, y: 21, copy: "smallpipewarptop", conf: {direction: 1, size: 0}, noflip: true},
	"smallpipewarpleft": {x: 19, y: 21, copy: "smallpipewarptop", conf: {direction: 3, size: 0}},
	
	"door1": {x: 16, y: 12, h: 2, show: {name: "Door", category: 3}, class: Door, menu: MenuPresets.door_warp, extralines: 3,
		animations: {"open": {x: 17, y: 12, h: 2, frames: 2, loop: false}}, iscontents: false, confconditions: [
			["type", 0, "modifier", 0, "door1"], ["type", 1, "modifier", 0, "door2"], ["type", 2, "modifier", 0, "door3"],
			["type", 0, "modifier", 1, "door1locked"], ["type", 1, "modifier", 1, "door2locked"], ["type", 2, "modifier", 1, "door3locked"],
			["type", 0, "modifier", 2, "door1timer"], ["type", 1, "modifier", 2, "door2timer"], ["type", 2, "modifier", 2, "door3timer"],
		], variants: ["door1", "door2", "door3"]},
	"door2": {x: 19, y: 12, show: {name: "Door", category: 3, hidden: true}, copy: "door1", conf: {type: 1},
		animations: {"open": {x: 20, y: 12, h: 2, frames: 2, loop: false}}},
	"door3": {x: 22, y: 12, copy: "door2", conf: {type: 2}, animations: {"open": {x: 23, y: 12, h: 2, frames: 2, loop: false}}},
	"door1timer": {x: 16, y: 14, copy: "door2", conf: {modifier: 2}, animations: {"open": {x: 17, y: 14, h: 2, frames: 2, loop: false}}},
	"door2timer": {x: 19, y: 14, copy: "door2", conf: {type: 1, modifier: 2}, animations: {"open": {x: 20, y: 14, h: 2, frames: 2, loop: false}}},
	"door3timer": {x: 22, y: 14, copy: "door2", conf: {type: 2, modifier: 2}, animations: {"open": {x: 23, y: 14, h: 2, frames: 2, loop: false}}},
	"door1locked": {x: 24, y: 10, copy: "door2", conf: {modifier: 1}, animations: {"open": {x: 17, y: 16, h: 2, frames: 2, loop: false}}},
	"door2locked": {x: 24, y: 8, copy: "door2", conf: {type: 1, modifier: 1}, animations: {"open": {x: 20, y: 16, h: 2, frames: 2, loop: false}}},
	"door3locked": {x: 24, y: 6, copy: "door2", conf: {type: 2, modifier: 1}, animations: {"open": {x: 23, y: 16, h: 2, frames: 2, loop: false}}},
	"door1unlocked": {x: 16, y: 16, copy: "door2", conf: null, animations: {"open": {x: 17, y: 16, h: 2, frames: 2, loop: false}}},
	"door2unlocked": {x: 19, y: 16, copy: "door2", conf: null, animations: {"open": {x: 20, y: 16, h: 2, frames: 2, loop: false}}},
	"door3unlocked": {x: 22, y: 16, copy: "door2", conf: null, animations: {"open": {x: 23, y: 16, h: 2, frames: 2, loop: false}}},
	
	"customblock": {x: 7, y: 8, show: {name: "Customizable Block", category: 3}, class: CustomizableBlock,
		menu: MenuPresets.block_properties, widemenu: true, extralines: 6, iscontents: false},
	"sign": {x: 16, y: 9, show: {name: "Sign", category: 3}, menu: MenuPresets.background_npc, class: BackgroundNPC,
		confconditions: [["background", false, "sign"], ["background", true, "wallsign"]], widemenu: true, extralines: 4},
	"wallsign": {x: 17, y: 9, show: {name: "Sign", category: 3, hidden: true}, copy: "sign"},
	"stone": {x: 17, y: 8, show: {name: "Stone", category: 3}, class: BlockEntity, menu: MenuPresets.stone, confconditions: [
		["size", 1, "stone"], ["size", 2, "vertical", false, "stone_1x2"], ["size", 2, "vertical", true, "stone_2x1"],
		["size", 3, "vertical", false, "stone_1x3"], ["size", 3, "vertical", true, "stone_3x1"]
	]},
	"stone_1x2": {x: 16, y: 7, w: 2, show: {name: "Stone", category: 3, hidden: true}, copy: "stone", conf: {size: 2, vertical: false}},
	"stone_1x3": {x: 14, y: 6, w: 3, show: {name: "Stone", category: 3, hidden: true}, copy: "stone", conf: {size: 3, vertical: false}},
	"stone_2x1": {x: 16, y: 4, h: 2, show: {name: "Stone", category: 3, hidden: true}, copy: "stone", conf: {size: 2, vertical: true}},
	"stone_3x1": {x: 17, y: 4, h: 3, show: {name: "Stone", category: 3, hidden: true}, copy: "stone", conf: {size: 3, vertical: true}},
	"crate": {x: 6, y: 8, show: {name: "Crate", category: 3}, class: Crate, menu: MenuPresets.contents},
	"boomblock": {x: 24, y: 0, show: {name: "BOOM Block", category: 3}, class: BoomBlock, menu: MenuPresets.boom_block, widemenu: true,
		confconditions: [["type", 0, "boomblock"], ["type", 1, "boomblockair"], ["type", 2, "boomblockbrick"]]},
	"boomblockair": {x: 24, y: 1, show: {name: "BOOM Block", category: 3, hidden: true}, copy: "boomblock", conf: {type: 1}},
	"boomblockbrick": {x: 24, y: 2, copy: "boomblockair", conf: {type: 2}},
	"timerswitch": {x: 6, y: 13, show: {name: "Timer Switch", category: 3}, class: StepSwitch, menu: MenuPresets.blockentity_activatable},
	"spring": {x: 22, y: 18, show: {name: "Spring", category: 3}, class: Spring, menu: MenuPresets.spring,
		conf: {vertical: true}, animations: {"bounce": {x: 23, y: 18, frames: 2}}, confconditions: [
		["vertical", true, "high", false, "spring"], ["vertical", true, "high", true, "superspring"],
		["vertical", false, "high", false, "spring2"], ["vertical", false, "high", true, "superspring2"]],
		variants: ["spring", "spring2", "superspring", "superspring2"]},
	"spring2": {x: 22, y: 19, show: {name: "Sideways Spring", category: 3, hidden: true}, copy: "spring",
		conf: {vertical: false}, animations: {"bounce": {x: 23, y: 19, frames: 2}}},
	"superspring": {x: 22, y: 20, show: {name: "Super Spring", category: 3, hidden: true}, copy: "spring",
		conf: {vertical: true, high: true}, animations: {"bounce": {x: 23, y: 20, frames: 2}}},
	"superspring2": {x: 22, y: 21, show: {name: "Sideways Super Spring", category: 3, hidden: true}, copy: "spring",
		conf: {vertical: false, high: true}, animations: {"bounce": {x: 23, y: 21, frames: 2}}},
	
	// Projectiles
	"flowerball": {x: 6, y: 7.5, w: 1.5/4, h: 1.5/4, frames: 4, class: BouncingProjectile},
	
	// Extras
	"generator": {x: 0, y: 0, class: Generator},
	"fallingsand": {x: 12, y: 1, class: InstantFallingBlock},
	"fallingblock": {x: 13, y: 1, class: FallingBlock},
	"overlay_1": {x: 16, y: 1, h: 2, frames: 6, framespeed: 2},
	"leveltimer": {x: 10.5, y: 1.5}
};

const particledata = {
	"boom": {x: 0, y: 0, class: BoomParticle},
	"boom2": {x: 1, y: 0, class: BoomParticle},
	"boom3": {x: 2, y: 0, class: BoomParticle},
	"sparkle": {x: 3, y: 0, frames: 2, class: SparkleParticle},
	"powerup": {x: 5, y: 0, frames: 4, opacity: .8},
	"stars": {x: 9, y: 0, frames: 4, scale: 2},
	"brickbreak": {x: 0, y: 1, class: BreakParticle},
	"blockbreak": {x: 1, y: 1, class: BreakParticle},
	"smokepuff": {x: 2, y: 1, w: .5, h: .5, frames: 4, framespeed: 2},
	"smokepuffbig": {x: 8, y: 1, frames: 4, framespeed: 2},
	"hit": {x: 4, y: 1, frames: 4}
};

const uidata = {
	"top": {x: 0, y: 0, w: maxw, h: 105},
	"bottom": {x: 0, y: maxh-105, w: maxw, h: 105},
	"toptab": {x: 0, y: 277, w: 24, h: 30},
	"bottomtab": {x: 24, y: 276, w: 24, h: 30},
	"hotbar0": {x: 0, y: 105, w: 88, h: 85},
	"hotbar1": {x: 88, y: 105, w: 88, h: 85},
	"hotbar2": {x: 176, y: 105, w: 88, h: 85},
	"hotbar3": {x: 264, y: 105, w: 88, h: 85},
	"hotbarmenu": {x: 440, y: 105, w: 88, h: 85},
	"hotbarmenu2": {x: 352, y: 105, w: 88, h: 85},
	"hotbarhover": {x: 528, y: 105, w: 88, h: 85},
	"hotbarhover2": {x: 616, y: 105, w: 88, h: 85},
	"hotbarselected": {x: 704, y: 105, w: 88, h: 85},
	"hotbarclose": {x: 792, y: 105, w: 64, h: 64},
	"hotbarback": {x: 856, y: 105, w: 64, h: 64},
	"uibtnhover": {x: 0, y: 190, w: 86, h: 86},
	"uibtnoutline": {x: 86, y: 190, w: 86, h: 86},
	"uibtnselected": {x: 172, y: 190, w: 86, h: 86},
	"playbtn": {x: 258, y: 190, w: 86, h: 86},
	"stopbtn": {x: 430, y: 190, w: 64, h: 64},
	"settingsbtn": {x: 344, y: 190, w: 86, h: 86},
	"settingsbtnselected": {x: 494, y: 190, w: 86, h: 86},
	"prefsbtn": {x: 580, y: 190, w: 86, h: 86},
	"prefsbtnselected": {x: 666, y: 190, w: 86, h: 86},
	"erasericon": {x: 48, y: 276, w: 63, h: 63},
	"erasericon2": {x: 111, y: 276, w: 63, h: 63},
	"multiselecticon": {x: 174, y: 276, w: 63, h: 63},
	"bucketicon": {x: 237, y: 276, w: 63, h: 63},
	"saveicon": {x: 300, y: 276, w: 63, h: 63},
	"loadicon": {x: 363, y: 276, w: 63, h: 63},
	"copyicon": {x: 426, y: 276, w: 63, h: 63},
	"clipboardicon": {x: 489, y: 276, w: 63, h: 63},
	"pasteicon": {x: 552, y: 276, w: 63, h: 63},
	"downloadicon": {x: 615, y: 276, w: 63, h: 63},
	"arrowsicon": {x: 678, y: 276, w: 63, h: 63},
	"fliphicon": {x: 741, y: 276, w: 63, h: 63},
	"flipvicon": {x: 804, y: 276, w: 63, h: 63}
};

const audiodata = {
	"break": {},
	"coin": {},
	"large_coin": {},
	"key": {},
	"key_coin": {},
	"bad_key": {},
	"door": {},
	"jump": {},
	"bounce": {},
	"death": {},
	"finish": {},
	"checkpoint": {},
	"powerup": {},
	"powerup_small": {},
	"explosion": {},
	"block_release": {},
	"bump": {},
	"kill": {},
	"kill_small": {},
	"hurt": {},
	"kick": {},
	"onoff": {},
	"pow": {},
	"switch": {},
	"message": {},
	"fireball_shoot": {},
	"door": {},
	"door2": {},
	"no_key": {},
	"unlock": {},
	"pipe": {},
	"extra_life": {},
	"thump": {}
};

function scale_dims(d){
    d.x *= tilew;
    d.y *= tilew;
    d.w *= tilew;
    d.h *= tilew;
}
function add_to_indexed_category(d, k, type){
	if (d.show.index != null) indexedcategories[d.show.category].tiles.splice(d.show.index, 0, {id: k, type: type});
	else indexedcategories[d.show.category].tiles.push({id: k, type: type});
}

var blocksheet = new Image();
blocksheet.src = "images/blocks.png";
for (k of Object.keys(blockdata)){
	d = blockdata[k];
	if (d.copy !== undefined){
		blockdata[k] = d = {...blockdata[d.copy], ...d};
	}
    if (d.w === undefined) d.w = 1;
    if (d.h === undefined) d.h = 1;
    if (d.collision === undefined) d.collision = [0, 0, d.w, d.h];
	if (d.loop === undefined) d.loop = true;
	if (d.limit === undefined) d.limit = 0;
	if (d.hascontents === undefined) d.hascontents = d.collision != null; // have no contents by default if no collision
	if (d.dynamic == 1) indexeddynamicblocks.push(k);
	if (d.show !== undefined){
		if (d.show.name === undefined) d.show.name = k;
		if (d.show.category === undefined) d.show.category = 0;
		if (!d.show.hidden) add_to_indexed_category(d, k, 0);
	}
}
for (k of Object.keys(blockdata)){
	d = blockdata[k];
	scale_dims(d);
}

var entitysheet = new Image();
entitysheet.src = "images/entities.png";
entitysheet.style.transform = "scaleX(-1)";
for (k of Object.keys(entitydata)){
    d = entitydata[k];
	if (d.copy !== undefined){
		anims = {...d.animations};
		entitydata[k] = d = {...entitydata[d.copy], ...d};
		if (d.animations !== undefined) entitydata[k].animations = d.animations = undefined; // do not copy animations (due to scaling issues)
		d.animations = anims;
	}
	if (d.w === undefined) d.w = 1;
    if (d.h === undefined) d.h = 1;
	if (d.loop === undefined) d.loop = true;
	if (d.iscontents === undefined) d.iscontents = true;
	if (d.show !== undefined){
		if (d.show.name === undefined) d.show.name = k;
		if (d.show.category === undefined) d.show.category = 2;
		if (!d.show.hidden) add_to_indexed_category(d, k, 1);
	}
	if (d.animations !== undefined){
		for (k2 of Object.keys(d.animations)){
			anim = d.animations[k2];
			if (anim.w === undefined) anim.w = 1;
			if (anim.h === undefined) anim.h = 1;
			if (anim.loop === undefined) anim.loop = true;
		}
	}
}
for (k of Object.keys(entitydata)){ // scale dims in separate loop so copy parameter works
	d = entitydata[k];
	if (d.animations !== undefined){
		for (k2 of Object.keys(d.animations)){
			scale_dims(d.animations[k2]);
		}
	}
	scale_dims(d);
}

var particlesheet = new Image();
particlesheet.src = "images/particles.png";
for (k of Object.keys(particledata)){
	d = particledata[k];
    if (d.w === undefined) d.w = 1;
    if (d.h === undefined) d.h = 1;
	if (d.frames === undefined) d.frames = 1;
	scale_dims(d);
}

var uisheet = new Image();
uisheet.src = "images/ui.png";
