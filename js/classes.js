const NO_SOUND = "no_sound";
const NO_CONTENTS = "no_contents";
const NO_COLLIDE = "no_collide";
const COLLIDED = "collided";
const COLLIDE_SPECIAL = "collide_special";
const COYOTE_TICKS = 3; // how many frames the player can jump for after leaving the ground

// Entities

class EntityBase {
	constructor(ent, sprite, hitbox){
		this.id = ent.id, this.x = ent.x*tilew, this.y = ent.y*tilew;
		this.conf = (ent.conf == null)?{}:{...ent.conf};
		if (sprite == null) sprite = entitydata[this.id];
		this.sprite = {...sprite};
		this.vx = 0, this.vy = 0; // x and y velocity
		this.fixed_vx = 0, this.fixed_vy = 0; // movement applied from riding entities/platforms
		this.last_vx = this.vx+this.fixed_vx, this.last_vy = this.vy+this.fixed_vy; // velocity after applying gravity but before collision
		this.potential_vx = null; // velocity to be applied once in the air, represented as [vx, fixed_vx]
		this.air_tick = maxint; // how many ticks in air
		this.on_ground = false;
		this.jump_buffer = 0;
		this.launch_speed = 0; // vx on frame when entity just left the ground
		this.gravity = 1;
		this.hbox = null; // hitbox (x, y, w, h)
		this.anim_frame = 0; // current frame of animation
		this.last_anim = null; // animation used on previous frame
		this.facing_left = true;
		this.can_interact = false; // whether the entity should be treated as a player
		this.obey_conveyor = false; // whether to turn around when touching a conveyor going the opposite direction
		this.despawn_distance = 15; // how far away the entity needs to be from the camera border to despawn
		this.state = 0, this.flash_state = null, this.flash_time = 0;
		this.x_freeze = 0, this.y_freeze = 0; // how many frames to freeze the axis for
		this.revert_state = true; // whether the entity should revert to state 1 when hit with state > 1
		this.overlay_effect = 0, this.overlay_time = 0; // which effect should be overlayed
		this.invincible = 0; // frames of invincibility
		this.cutscene = {id: null, frame: 0}; // cutscene data
		this.inventory = {}; // items collected
		this.idle_entity = false; // whether to ignore all collision and skip rendering
		this.remove_block_collision = false; // whether to collide with blocks
		this.remove_entity_collision = false; // whether to collide with entities which cannot interact
		this.global_stomp = 0; // 1 = triggers collision if stomped, 2 = triggers collision if collided regardless of stomp
		this.weight = 2; // certain weight thresholds activate mechanisms
		this.respawn_id = null; // entity id to respawn as, set to "" for no respawn
		this.projectile_type = {priority: 0, type: 0}; // type = 1 is for igniting bombs, other options include passthrough and projenemy
		this.is_player = false;
		this.link = null; // index of position in entities array
		this.set_hitbox(hitbox);
	}
	set_hitbox(hitbox){
		if (hitbox != null){ // array containing hitbox x, y, w, h relative to entity pos
			this.hbox = {x: hitbox[0], y: hitbox[1], w: hitbox[2], h: hitbox[3]};
		} else this.hbox = null;
	}
	pre_update(){}
	update(){}
	full_update(){
		if (this.flash_time > 0 && !this.idle_entity) this.flash_time--;
		if (this.state == -1){
			this.handle_x_collision();
			this.handle_y_collision();
			if (this.y+scrolly > maxh || this.y+this.sprite.h+scrolly < 0) this.kill();
			return;
		} else if (this.state == -2){
			this.air_tick++; // for counting how many ticks it's been dead for
			if (this.air_tick > 16) this.kill();
			return;
		}
		if (ptvars.globalfreeze.id != null && this.cutscene.id != "pipe") return;
		if (this.cutscene.previd != null){
			if (this.cutscene.previd == "release"){
				this.set_fvy(0);
			} else if (this.cutscene.previd == "jump_release"){
				this.vy = -12;
			} else if (this.cutscene.previd == "hidden") this.idle_entity = false;
			delete this.cutscene.previd;
		}
		if (this.cutscene.id == "release" || this.cutscene.id == "jump_release"){
			this.last_vy = this.fixed_vy;
			this.set_fvy(-this.sprite.h/((this.cutscene.id == "jump_release")?8:16)*this.cutscene.top);
		} else if (this.cutscene.id == "pipe"){
			if (this.cutscene.frame > 29){
				this.cutscene.frame--;
				return;
			}
			if (this.cutscene.frame == 29 && !this.cutscene.nosound) play_sound("pipe");
			if (this.cutscene.dir%2 == 0){
				this.last_vy = this.fixed_vy;
				this.set_fvy(tilew*2/30*(((this.cutscene.dir == 2) == !this.cutscene.entering)?-1:1));
			} else {
				this.last_vx = this.fixed_vx;
				this.set_fvx((this.hbox.w+tilew/2)/30*(((this.cutscene.dir == 3) == !this.cutscene.entering)?1:-1));
				if (this.last_anim == "walk") this.anim_frame += .5;
			}
			if (this.cutscene.frame == 0){
				if (ptvars.globalfreeze.id == null){
					this.set_fvy(0);
					this.handle_x_collision();
					this.handle_y_collision();
					if (this.cutscene.release) this.release(get_player_entity(), 1, true);
				} else this.cutscene.frame++;
			}
		} else if (this.cutscene.id == "hidden"){
			this.idle_entity = true;
		} else {
			this.pre_update();
			this.update();
		}
		if (this.check_despawn()) return;
		if (this.invincible > 0 && !this.idle_entity) this.invincible--;
		if (this.cutscene.frame > 0) this.cutscene.frame--;
		else if (this.cutscene.id != null){
			if (this.cutscene.next != null) this.cutscene = this.cutscene.next;
			else this.cutscene = {id: null, frame: 0, previd: this.cutscene.id};
		}
		if (this.overlay_time > 0) this.overlay_time--;
	}
	pre_despawn(start){}
	check_despawn(start=false){
		if (this.idle_entity) return false;
		if (this.despawn_distance < 0){
			this.despawn_distance++;
			return false;
		}
		if (this.despawn_distance == 0){
			if (this.pre_despawn(start) !== false) this.kill();
			return true;
		}
		var l = start?(3*tilew-1):(this.despawn_distance*tilew);
		if (this.x+this.sprite.w+scrollx < -l || this.x+scrollx > l+maxw){
			if (this.pre_despawn(start) !== false) this.kill(null, 1, true, !start);
			return true;
		}
		if (this.y+this.sprite.h < -tilew || this.y > ptvars.levelh+tilew){
			if (this.pre_despawn(start) !== false) this.kill(null, 1, !this.is_player, !start);
			return true;
		}
		return false;
	}
	overlay_texture(num, img, sx, sy, sw, sh){
		var canvas2 = document.createElement("canvas");
		canvas2.width = sw, canvas2.height = sh;
		var ctx2 = canvas2.getContext("2d");
		ctx2.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
		ctx2.globalCompositeOperation = "source-atop";
		var d2 = entitydata["overlay_"+num];
		ctx2.drawImage(img, d2.x+Math.floor(ptvars.globaltimer/(d2.framespeed || 4))%d2.frames*tilew, d2.y, d2.w, d2.h, 0, 0, sw, sh);
		return canvas2;
	}
	draw_sprite(anim, xofs=0, yofs=0, flipx=false, flipy=false){
		if (anim != null){
			if (!(anim in this.sprite.animations)) return;
			anim = this.sprite.animations[anim];
		} else anim = this.sprite;
		var nx = this.x+scrollx+xofs, ny = this.y+scrolly+yofs;
		if (nx > maxw || ny > maxh || nx < -anim.w || ny < -anim.h) return;
		var nw = anim.w, nh = anim.h;
		var sx = anim.x, sy = anim.y, sw = anim.w, sh = anim.h;
		if (anim.frames != null && anim.frames > 1){
			var f = Math.floor(this.anim_frame);
			if (anim.loop) f %= anim.frames;
			else f = Math.max(Math.min(f, anim.frames-1), 0);
			sx += sw*f;
		}
		if (!this.facing_left) flipx = !flipx;
		if (this.state == -1) flipy = !flipy;
		if (this.state == -2){
			ny += nh*.75, nh *= .25;
		} else if (this.state > -1){
			if (this.cutscene.id == "release" || this.cutscene.id == "jump_release"){
				var incr = (this.cutscene.frame+1)/((this.cutscene.id == "jump_release")?8:16)*this.sprite.h;
				nh -= incr, sh -= incr;
				if (this.cutscene.top < 0) ny += incr, sy += incr;
			} else if (this.cutscene.id == "pipe"){
				if (this.cutscene.dir == 2){
					var incr = this.cutscene.cutoff+scrolly-ny;
					nh = incr, sh = incr;
				} else if (this.cutscene.dir == 0){
					var incr = ny+nh-this.cutscene.cutoff-scrolly;
					ny += nh-incr, sy += sh-incr;
					nh = incr, sh = incr
				} else if (this.cutscene.dir == 1){
					var incr = this.cutscene.cutoff+scrollx-nx;
					if (flipx) sx += sw-incr;
					nw = incr, sw = incr;
				} else if (this.cutscene.dir == 3){
					var incr = nx+nw-this.cutscene.cutoff-scrollx;
					nx += nw-incr;
					if (!flipx) sx += sw-incr;
					nw = incr, sw = incr;
				}
			}
			nh = Math.max(nh, 0), sh = Math.max(sh, 0);
			nw = Math.max(nw, 0), sw = Math.max(sw, 0);
		}
		ctx.save();
		if (flipx){
			ctx.scale(-1, 1);
			nx = -nx-nw;
		}
		if (flipy){
			ctx.scale(1, -1);
			ny = -ny-nh;
		}
		if (this.overlay_time > 0){
			if (Math.floor(Math.abs(sw)) != 0 && Math.floor(Math.abs(sh)) != 0){
				ctx.drawImage(this.overlay_texture(this.overlay_effect, entitysheet, sx, sy, sw, sh), nx, ny, nw, nh);
			}
		} else ctx.drawImage(entitysheet, sx, sy, sw, sh, nx, ny, nw, nh);
		ctx.restore();
		return anim;
	}
	render(){
		this.draw_sprite();
		this.last_anim = null;
		if (this.state == -2) return;
		if (ptvars.globalfreeze.id == null) this.anim_frame += 1/(this.sprite.framespeed || 4);
	}
	full_render(){
		if (!this.idle_entity){
			if (this.flash_time > 0 && ptvars.globalfreeze.id == null){
				if (this.flash_state < 0){
					if (Math.floor(this.flash_time/4)%2 == 0) this.render();
				} else if (Math.floor(this.flash_time/4)%2 == 0){
					var prev = this.state;
					this.set_state(this.flash_state, false);
					this.render();
					this.set_state(prev, false);
				} else this.render();
			} else this.render();
		}
		if (prefs.showhitboxes && this.hbox != null){
			ctx.globalAlpha = .4;
			if (this.sprite.show != null){
				ctx.fillStyle = indexedcategories[dict_get(this.sprite.show, "category", 0)].color;
			} else ctx.fillStyle = "white";
			ctx.fillRect(this.x+this.hbox.x+scrollx, this.y+this.hbox.y+scrolly, this.hbox.w, this.hbox.h);
			ctx.globalAlpha = 1;
		}
	}
	get hbox_l(){return this.x+this.hbox.x}
	get hbox_r(){return this.hbox_l+this.hbox.w}
	get hbox_t(){return this.y+this.hbox.y}
	get hbox_b(){return this.hbox_t+this.hbox.h}
	hitbox_intersects_block(b, self){
		if (self == null) self = this;
		if (self.hbox == null || b == null) return false;
		return !(self.hbox_b <= b.y || self.hbox_t >= b.y+b.h || self.hbox_r <= b.x || self.hbox_l >= b.x+b.w);
	}
	hitbox_intersects_entity(ent, self){
		if (self == null) self = this;
		if (self.hbox == null || ent.hbox == null) return false;
		return !(self.hbox_b <= ent.hbox_t || self.hbox_t >= ent.hbox_b || self.hbox_r <= ent.hbox_l || self.hbox_l >= ent.hbox_r);
	}
	collision_hitbox_intersects_entity(ent){
		return this.hitbox_intersects_entity(ent);
	}
	handle_hurt_collision(hurts, side, x, y, block=null){
		if (hurts == 0 || (!this.is_player && hurts != 2)) return;
		if ((hurts == 3 && side == 2) || (hurts == 4 && side == 0) || (hurts == 5 && side == 1) || (hurts == 6 && side == 3)) return;
		if (this.invincible <= 0){
			if (block == null) block = ptblocks[x][y];
			if (hurts == 3) release_contents(x, y, this, block, null, false, false); // release bottom
			else if (hurts == 4) release_contents(x, y, this, block, null, false, true); // release top
			else { // destroy and release all
				if (block.contents.length > 0){
					release_all_contents(x, y, this, block);
					set_playtest_tile(x, y, {id: null, type: 0});
				}
			}
		}
		if (hurts == 2){
			if (this.invincible <= 0) this.kill(null, 1);
		} else this.hurt();
	}
	handle_block_collisions(vert, hurtcheck=0){
		if (this.hbox == null) return 0;
		for (var x = Math.floor(this.hbox_l/tilew); x <= Math.floor(this.hbox_r/tilew); x++){
			for (var y = Math.floor(this.hbox_t/tilew); y <= Math.floor(this.hbox_b/tilew); y++){
				var block = get_playtest_tile(x, y, 0);
				if (block.id == null){
					if (block.bumped == 8 && this.hitbox_intersects_block({x: x*tilew, y: y*tilew, w: tilew, h: tilew})){
						this.bump_below(block.bumpedby);
						if (this.hbox == null) return;
					}
					continue;
				}
				var b = get_block_collision(block, x, y);
				if (b == null || !this.hitbox_intersects_block(b)) continue;
				var d = blockdata[block.id];
				var hurts = get_property(d, "hurts");
				if ((hurtcheck == 0 && hurts > 0) || (hurtcheck == 1 && hurts <= 0)) continue;
				var semisolid = get_property(d, "semisolid");
				if (semisolid > 0){
					if (semisolid == 1 && (!vert || this.hbox_b-b.y-this.last_vy >= .1)) continue;
					else if (semisolid == 2 && (!vert || b.y+b.h-this.hbox_t+this.last_vy >= .1)) continue;
					else if (semisolid == 3 && (vert || this.hbox_r-b.x-Math.max(this.vx+this.fixed_vx, 0) >= .1)) continue;
					else if (semisolid == 4 && (vert || b.x+b.w-this.hbox_l+Math.min(this.vx+this.fixed_vx, 0) >= .1)) continue;
				}
				if ((this.is_player && get_property(d, "playerpass")) || (!this.is_player && get_property(d, "entitypass"))){
					release_all_contents(x, y, this, block);
					continue;
				}
				if (hurtcheck != 1){
					var sp = handle_special_collision(this, block, x, y);
					if (sp == NO_COLLIDE) continue;
					else if (sp == COLLIDED) return 1;
					else if (sp == COLLIDE_SPECIAL) return 2;
				}
				var side = null;
				var hidden = get_property(d, "hidden");
				if (vert){
					if (b.y+b.h-this.hbox_t+this.last_vy < .1){ // entity on bottom of block
						side = 2;
						var dohit = true;
						if (this.is_player && hurtcheck != 1 && semisolid == 0){
							if (this.hbox_r-b.x <= 10 && !hidden){ // left side clip
								if (get_playtest_tile(x-1, y, 0).id == null){
									this.x -= this.hbox_r-b.x;
									if (!(this.crouch_state > 1 && this.vx < 0)) return 1;
								}
								dohit = false;
							}
							if (b.x-this.hbox_l > 10) activate_block(x-1, y, this);
							if (b.x+b.w-this.hbox_l <= 10 && !hidden){ // right side clip
								if (hidden) continue;
								if (get_playtest_tile(x+1, y, 0).id == null){
									this.x += b.x+b.w-this.hbox_l;
									if (!(this.crouch_state > 1 && this.vx > 0)) return 1;
								}
								dohit = false;
							}
							if (this.hbox_r-b.x-b.w > 10) activate_block(x+1, y, this);
						}
						this.y = b.y+b.h-this.hbox.y;
						if (this.vy < 0) this.vy *= -.1;
						this.jump_buffer = maxint;
						if (dohit) activate_block(x, y, this, block);
					} else if (this.hbox_b-b.y-this.last_vy < .1){ // entity on top of block
						if (hidden) continue;
						side = 0;
						this.y = b.y-this.hbox.y-this.hbox.h;
						this.vy = 0, this.air_tick = 0;
						this.on_ground = true;
						if (block.bumped > 0){
							this.bump_below(block.bumpedby);
							if (this.hbox == null) return;
						}
					} else if (hidden){
						continue;
					} else {
						if (this.pre_crush() !== false) this.hurt(null, true, true);
					}
				} else {
					if (hidden) continue;
					if (this.is_player && this.hbox_b-b.y <= 10 && this.global_stomp < 2 && semisolid == 0 && Math.abs(this.vy) < 4){ // top clip
						this.y -= this.hbox_b-b.y;
						this.vy = 0;
						return 2;
					} else {
						if (this.projectile_type.projenemy) activate_block(x, y, this, block);
						if (b.x+b.w-this.hbox_l+Math.min(this.last_vx, 0) < .1){ // entity on right of block
							side = 1;
							this.x = b.x+b.w-this.hbox.x;
							if (this.vx < 0) this.vx = 0;
						} else if (this.hbox_r-b.x-Math.max(this.last_vx, 0) < .1){ // entity on left of block
							side = 3;
							this.x = b.x-this.hbox.x-this.hbox.w;
							if (this.vx > 0) this.vx = 0;
						} else { // crush entity
							if (!this.is_player || this.crouch_state > 0){
								if (this.pre_crush() !== false) this.hurt(null, true, true);
							} else {
								this.crouch_state = 2;
								this.set_state(this.state); // refresh hitbox
							}
							return 1;
						}
						this.set_fvx(0);
					}
				}
				if (hurtcheck > 0){
					this.handle_hurt_collision(hurts, side, x, y, block);
					if (this.hbox == null) return;
				}
				return 1;
			}
		}
		return 0; // no collision
	}
	set_fvx(amount, apply=true){
		this.fixed_vx = amount;
		if (apply) this.x += amount;
	}
	set_fvy(amount, apply=true){
		this.fixed_vy = amount;
		if (apply) this.y += amount;
	}
	add_fvx(amount, apply=true){
		this.fixed_vx += amount;
		if (apply) this.x += amount;
	}
	add_fvy(amount, apply=true){
		this.fixed_vy += amount;
		if (apply) this.y += amount;
	}
	handle_x_collision(applyvel=true, collide=true){
		if (applyvel){
			if (this.x_freeze > 0) this.x_freeze--;
			else {
				var vel = this.vx;
				if (vel >= tilew) vel = tilew-1;
				else if (vel <= -tilew) vel = -tilew+1;
				this.x += vel;
				this.last_vx = vel+this.fixed_vx;
			}
		}
		var i = 0;
		if (collide && this.hbox != null && !this.remove_block_collision && !this.idle_entity){
			while (this.handle_block_collisions(false, this.can_interact?0:2) == 1) i++;
			if (ptvars.playing && this.can_interact){
				while (this.handle_block_collisions(false, 1) == 1) i++;
			}
		}
		if (applyvel) this.fixed_vx = 0;
		return i;
	}
	handle_y_collision(applyvel=true, collide=true){
		if (applyvel){
			this.on_ground = false;
			this.air_tick++;
			if (this.y_freeze > 0) this.y_freeze--;
			else {
				this.vy += this.gravity;
				var vel = this.vy;
				if (vel >= tilew) vel = tilew-1;
				else if (vel <= -tilew) vel = -tilew+1;
				this.y += vel;
				this.last_vy = vel+this.fixed_vy;
			}
		}
		var i = 0;
		if (collide && this.hbox != null && !this.remove_block_collision && !this.idle_entity){
			while (this.handle_block_collisions(true, this.can_interact?0:2) == 1) i++;
			if (ptvars.playing){
				while (this.handle_block_collisions(true, 1) == 1) i++;
			}
		}
		if (applyvel){
			if (this.air_tick == 0){
				var prev = null;
				if (this.potential_vx != null) prev = [...this.potential_vx];
				this.launch_speed = 0, this.potential_vx = null;
				if (collide && this.hbox != null){
					for (var xofs of [this.hbox.w/2, 0, this.hbox.w]){ // conveyor belts
						var x = this.hbox_l+xofs;
						var speed = point_collides_block(x, this.hbox_b+2);
						if (speed == null) continue;
						speed = get_property(blockdata[speed.id], "conveyorspeed");
						if (speed == null || speed == 0) break;
						if (this.obey_conveyor && this.facing_left == (speed > 0)) this.turn();
						speed *= 33/6;
						if (prev != null && Math.abs(prev[0]) > 4 && (prev[0] > 0) == (speed < 0)){
							speed = prev[0]*.5;
						}
						this.add_fvx(speed);
						if (Math.abs(speed) > 4) this.potential_vx = [speed, speed];
						else if (speed > 0) this.potential_vx = [0, speed, Math.floor(x/tilew+1)*tilew-this.hbox.x];
						else this.potential_vx = [0, speed, Math.floor(x/tilew)*tilew-this.hbox.x-this.hbox.w];
						this.handle_x_collision(false);
						break;
					}
					if (this.can_interact){ // falling blocks
						var x = this.hbox_l, y = this.hbox_b+2;
						var below = point_collides_block_property(x, y, "stepspawn");
						if (below != null) spawn_from_step(below, Math.floor(x/tilew), Math.floor(y/tilew), this);
						if (this.hbox == null) return;
						x += this.hbox.w;
						below = point_collides_block_property(x, y, "stepspawn");
						if (below != null) spawn_from_step(below, Math.floor(x/tilew), Math.floor(y/tilew), this);
						if (this.hbox == null) return;
					}
				}
			} else if (this.air_tick == 1){
				if (this.hbox != null && this.potential_vx != null && point_collides_block(this.hbox_l+this.hbox.w/2, this.hbox_b+2) == null){
					if (this.potential_vx.length > 2){
						if (Math.abs(this.x-this.potential_vx[2]) <= Math.abs(this.potential_vx[1])){
							this.x = this.potential_vx[2];
						}
					} else {
						this.add_fvx(this.potential_vx[1]);
					}
					this.vx += this.potential_vx[0];
					this.potential_vx = null;
					this.handle_x_collision(false);
				}
				this.launch_speed = this.vx;
			}
			this.set_fvy(0);
			if (i > 0 && this.on_ground) this.post_standing_terrain();
		}
		return i;
	}
	handle_entity_collision(){
		if (this.hbox == null || this.idle_entity) return 0;
		var ret = 0;
		for (collisioniter = 0; collisioniter < ptentities.length; collisioniter++){
			var ent = ptentities[collisioniter];
			if (!check_simple_collision(this, ent)) continue;
			var gstomp = false;
			if (this.is_player || ent.is_player){
				if (this.is_player && ent.is_player){ // player + player
					var dist = this.hbox_l+this.hbox.w/2-ent.hbox_l-ent.hbox.w/2;
					if (dist >= 0 && dist < 2) dist = 2;
					else if (dist < 0 && dist > -2) dist = -2;
					dist /= 8;
					if (!this.collided_player && this.crouch_state == 0 && this.x_freeze == 0){
						this.add_fvx(dist);
					}
					if (!ent.collided_player && ent.crouch_state == 0 && this.x_freeze == 0){
						ent.add_fvx(-dist);
					}
					this.collided_player = ent.collided_player = true;
				} else { // player + entity
					if (ent.is_player) this.collide_player(ent, ent.check_stomp(this));
					else ent.collide_player(this, this.check_stomp(ent));
				}
			} else if (this.projectile_type.priority > 0 || ent.projectile_type.priority > 0){
				// collision with projectile
				if (this.projectile_type.priority > ent.projectile_type.priority){
					if (this.owner != ent){
						if (ent.hit_by_projectile(this.owner, this) !== false) this.projectile_hit(ent);
					}
				} else if (this.projectile_type.priority < ent.projectile_type.priority){
					if (ent.owner != this){
						if (this.hit_by_projectile(ent.owner, ent) !== false) ent.projectile_hit(this);
					}
				} else if (this.facing_left && !ent.facing_left && this.hbox_l > ent.hbox_l && this.hbox_l <= ent.hbox_r){
					this.kill(); ent.kill();
				} else if (!this.facing_left && ent.facing_left && ent.hbox_r >= this.hbox_l && ent.hbox_r < this.hbox_r){
					this.kill(); ent.kill();
				}
			} else if (this.global_stomp > 1 || ent.global_stomp > 1){
				// block entity
				gstomp = true;
			} else if (this.projectile_type.projenemy || ent.projectile_type.projenemy){
				// kicked shell
				if (this.projectile_type.projenemy) ent.hit_by_projectile(this);
				if (ent.projectile_type.projenemy) this.hit_by_projectile(ent);
			} else if (this.air_tick == 0 && ent.air_tick == 0){
				// entity + entity (grounded only)
				var left = this.hbox_r-ent.hbox_l; // this on left of ent
				left = left >= 0 && left < 12;
				var right = ent.hbox_r-this.hbox_l; // this on right of ent
				right = right >= 0 && right < 12;
				if (left == right) continue;
				if (this.facing_left && !ent.facing_left){
					if (left) continue;
					ent.turn(); this.turn();
				} else if (!this.facing_left && ent.facing_left){
					if (right) continue;
					ent.turn(); this.turn();
				} else if (this.facing_left && ent.facing_left){
					if (left) ent.turn();
					else if (right) this.turn();
				} else if (!this.facing_left && !ent.facing_left){
					if (left) this.turn();
					else if (right) ent.turn();
				}
			} else if (this.global_stomp > 0 || ent.global_stomp > 0){
				// blockhead
				gstomp = true;
			}
			if (gstomp){
				var ts = ent.check_stomp(this);
				var es = this.check_stomp(ent);
				if (this.global_stomp == 1 && ts){
					if (this.collide_player(ent, true) !== false) ret++;
				} else if (ent.global_stomp == 1 && es){
					if (ent.collide_player(this, true) !== false) ret++;
				} else if (this.global_stomp == 2){
					if (this.collide_player(ent, ts) !== false) ret++;
				} else if (ent.global_stomp == 2){
					if (ent.collide_player(this, es) !== false) ret++;
				}
			}
		}
		return ret;
	}
	get ptindex(){
		var idx = ptentities.indexOf(this);
		if (idx > -1) return idx;
	}
	pre_crush(ply){}
	pre_kill(ply, removed){}
	kill(ply, animnum=0, despawn=false, playersound=null){
		var sp = null;
		if (!despawn){
			if (this.respawn_id != null && this.link != null) ptvars.entitystates[this.link].respawn_id = this.respawn_id;
			sp = this.pre_kill(ply, animnum <= 0);
		}
		if (this.link != null) ptvars.entitystates[this.link].state = despawn?0:-1;
		this.set_hitbox(null);
		if (sp != NO_SOUND && this.is_player && playersound !== false && (animnum > 0 || playersound)) play_sound("death");
		if (ply != null){
			for (k of Object.keys(this.inventory)){
				if (this.inventory[k] > 0) ply.add_inventory(k, this.inventory[k]);
			}
			this.inventory = {};
		}
		var idx = this.ptindex;
		if (animnum > 0 && !despawn){
			if (animnum == 1){
				this.state = -1;
				if (this.gravity == 0) this.gravity = 1;
				else this.gravity = this.gravity/Math.abs(this.gravity);
				if (this.vx == 0) this.vx = this.facing_left*4-2;
				else this.vx = this.vx/Math.abs(this.vx)*-3;
				this.vy = -12*this.gravity;
				if (idx != null){ // render in front of everything else
					ptentities.unshift(ptentities.splice(idx, 1)[0]);
				}
			}  else if (animnum == 2){
				this.state = -2;
				this.gravity = 0;
				this.vx = 0, this.vy = 0;
				this.air_tick = 0;
			}
		} else if (idx != null){
			ptentities.splice(idx, 1);
			if (globaliter >= idx) globaliter--;
			if (collisioniter >= idx) collisioniter--;
		}
		return sp;
	}
	pre_hurt(ply, stomp, force){}
	hurt(ply, stomp=null, force=false){
		if (this.invincible > 0 && !force) return;
		if (stomp == null) stomp = !force;
		if (this.pre_hurt(ply, stomp, force) === false) return;
		if (this.state == 0 || (this.state > 1 && !this.revert_state)){
			if (this.can_interact && force && (this.y+this.sprite.h+scrolly < 0 || this.y+scrolly > maxh)) return this.kill(ply);
			if (!stomp || this.can_interact) return this.kill(ply, 1);
			return this.kill(ply, 2);
		}
		if (this.is_player){
			play_sound("hurt");
			this.action_anim = null;
		}
		if (this.state == 1) this.set_state(0);
		else this.set_state(1);
		this.invincible = 120;
		this.set_flash_state(-1, 120);
	}
	hit_by_projectile(ply){
		this.hurt(ply, false);
		play_sound("kill_small");
	}
	set_flash_state(state, time){
		if (this.flash_state > -1) this.flash_state = state;
		if (time > this.flash_time) this.flash_time = time;
	}
	get_inventory(item){
		return this.inventory[item] ?? 0;
	}
	add_inventory(item, count=1){
		this.inventory[item] ??= 0;
		var inv = this.inventory[item] += count;
		if (inv <= 0) delete this.inventory[item];
		return inv;
	}
	release(ply, top=1, pipe=false){
		this.last_vy = -this.sprite.h/16*top;
		this.set_fvy(this.last_vy, false);
		this.y += this.vy;
		if (get_config(this, "direction") == 2) this.facing_left = !this.facing_left;
		this.cutscene = {id: "release", frame: 15, top: top};
		if (!pipe) play_sound("block_release");
	}
	set_id(id, lock=false){
		this.id = id;
		if (lock){
			this.respawn_id = id;
			if (this.link != null) ptvars.entitystates[this.link].respawn_id = id;
		}
		this.sprite = entitydata[this.id];
		if (this.sprite.conf != null) this.conf = {...this.conf, ...this.sprite.conf};
	}
	post_standing_terrain(){}
	simulate_terrain(ent, sticky=true){
		this.y = ent.hbox_t-this.hbox.y-this.hbox.h;
		this.vy = ent.vy;
		this.set_fvy(ent.fixed_vy, false);
		this.on_ground = true;
		if (sticky && (this.is_player || this.vx+this.fixed_vx == 0) && this.x_freeze == 0){
			var vel = ent.vx+ent.fixed_vx;
			this.fixed_vx += vel, this.x += vel;
		}
		if (this.is_player){
			this.standing_surface = 0;
			this.refresh_crouch_state();
			if (dirkeys.jump && this.jump_buffer == 0){
				this.jump_buffer = 1, this.air_tick = 0;
				play_sound("jump");
			}
		}
		this.post_standing_terrain();
	}
	simulate_bounce(ent, vel, specialvy=null){
		this.y = ent.hbox_t-this.hbox.y-this.hbox.h;
		if (ent.fixed_vy-vel < this.vy) this.vy = ent.fixed_vy-vel;
		if (this.is_player || specialvy != null) play_sound("bounce");
		if (this.is_player){
			this.standing_surface = 0;
			if (specialvy == null) this.vx = 0;
			this.launch_speed = this.vx;
			this.refresh_crouch_state();
			if (dirkeys.jump && (this.jump_buffer == 0 || specialvy == null)){
				this.jump_buffer = 1;
				if (specialvy != null) this.vy -= specialvy;
			}
		}
	}
	check_stomp(ent, self, debug=false){
		if (self == null) self = this;
		var overlap = self.hbox_b-ent.hbox_t;
		var v1 = this.vy+this.fixed_vy, v2 = ent.fixed_vy+ent.vy;
		if (debug) console.log("Overlap: "+overlap+"\nThreshold: "+(v1-v2)+"\nv1: "+v1+", v2: "+v2+"\nResult: "+(overlap-v1+v2));
		if (overlap-v1+v2 < .1) return true;
		v1 = self.last_vy, v2 = ent.last_vy;
		if (overlap-v1+v2 < .1) return true;
		return false;
	}
	with_hitbox(hitbox){
		return {
			x: this.x, y: this.y, vx: this.vx, vy: this.vy,
			fixed_vx: this.fixed_vx, fixed_vy: this.fixed_vy, last_vx: this.last_vx, last_vy: this.last_vy,
			hbox: {x: hitbox[0], y: hitbox[1], w: hitbox[2], h: hitbox[3]},
			hbox_l: this.x+hitbox[0], hbox_r: this.x+hitbox[0]+hitbox[2],
			hbox_t: this.y+hitbox[1], hbox_b: this.y+hitbox[1]+hitbox[3]
		};
	}
	star_killed(ply){
		if (ply.overlay_effect != 1) return false;
		spawn_hit_particle_from_collision(this, ply);
		play_sound("kill_small");
		this.kill(ply, 1);
		drop_contents(this, ply);
		return true;
	}
	set_state(state){this.state = state}
	powwed(ent){this.kill(ent, 1)} // when this is affected by a boom block
	collide_player(ply, stomp){} // when this collides with player
	bump_below(ply){} // when the block below the entity is bumped
	stomp(ent){} // when this stomps an entity
	turn(){} // when another entity walks into this
	drop(ply){} // when this is dropped from an entity by ply
	player_interact(ply){} // when the player presses up when in contact with this
	static bg_layer = 0; // layer of the entity, higher = further back
}

class Player extends EntityBase {
	constructor(ent, sprite){
		super(ent, sprite);
		this.y -= tilew/2;
		this.can_interact = true, this.is_player = true;
		this.character = this.conf.character ?? prefs.character;
		this.standing_surface = 0; // surface player is standing on
		this.collided_player = false; // collided with another player this frame
		this.run_last = maxint; // frames since run key pressed
		this.action_anim = null; // animation for special actions e.g. fireball
		this.crouch_state = 0; // 0 = not crouching, 1 = crouching, 2 = forced crouching
		this.set_state(get_config(this, "state"));
		if (get_config(this, "invinstar")){
			this.invincible = 30*60;
			this.overlay_effect = 1;
			this.overlay_time = this.invincible-60;
		}
	}
	set_state(state, hitbox=true){
		if (state > 0){
			if (hitbox){
				if (this.crouch_state > 0) this.set_hitbox([15, tilew+2, tilew-30, tilew-2]);
				else this.set_hitbox([15, 9, tilew-30, tilew*2-9]);
			}
			if (this.state == 0) this.y -= tilew/2;
		} else if (state == 0){
			if (hitbox) this.set_hitbox([15, tilew*.5+2, tilew-30, tilew-2]);
			if (this.state > 0) this.y += tilew/2;
		}
		this.state = state;
	}
	refresh_crouch_state(unforce=false){
		if (this.crouch_state < 2 || unforce){
			this.crouch_state = +dirkeys.down;
			this.set_state(this.state);
		}
	}
	pre_kill(ply, removed){
		if (!removed){
			//if (count_matching(ptentities, ent => ent.is_player && ent.state >= 0) > 1) return false;
			if (ptvars.playerlives > 0) ptvars.playerlives--;
		}
	}
	pre_hurt(ply){
		if (count_matching(ptentities, ent => ent.is_player && ent.state >= 0) > 1){
			this.kill(ply);
			play_sound("kill_small");
			if (ptvars.playerlives > 0) ptvars.playerlives--;
			return false;
		}
	}
	update(){
		if (this.respawn_id == null){
			this.respawn_id = "";
			if (this.link != null) ptvars.entitystates[this.link].respawn_id = "";
		}
		var d = dirkeys.right-dirkeys.left;
		if (d != 0 && !(this.on_ground && this.crouch_state > 0)){ // moving
			this.vx += d*(dirkeys.run?1.3:.7);
			if (this.overlay_effect == 1) this.vx += d*.4;
		}
		var dx = .9;
		var below;
		if (this.air_tick == 0){
			this.standing_surface = 0;
			below = point_collides_block_property(this.hbox_l+this.hbox.w/2, this.hbox_b+2, "surface");
			if (below != null){
				this.standing_surface = below;
				if (below == 1) dx = .94;
				else if (below == 2) dx = .76;
			}
		}
		this.vx *= dx;
		if (d > 0) this.facing_left = true;
		else if (d < 0) this.facing_left = false;
		else if (Math.abs(this.vx) < 1) this.vx = 0;
		if (this.on_ground) this.refresh_crouch_state(true);
		
		this.handle_x_collision();
		if (this.hbox == null) return;
		if (this.hbox_l < 0) this.x = -this.hbox.x;
		else if (this.hbox_r > ptvars.levelw) this.x = ptvars.levelw-this.hbox.x-this.hbox.w;
		
		var canceljump = false;
		if (dirkeys.interact > 0 && ptvars.globaltimer > 0 && this.cutscene.id == null && this.on_ground &&
				this.jump_buffer == 0 && this.crouch_state == 0){
			for (collisioniter = 0; collisioniter < ptentities.length; collisioniter++){
				ent = ptentities[collisioniter];
				if (!check_simple_collision(this, ent)) continue;
				if (ent.player_interact(this) === false) canceljump = true;
			}
		}
		if (dirkeys.jump && !canceljump){
			if (this.air_tick < COYOTE_TICKS && this.jump_buffer == 0){
				this.jump_buffer = 1;
				play_sound("jump");
			}
			var high = this.launch_speed != 0 && this.standing_surface != 2;
			if (this.jump_buffer < 4) high = high?-15:-12;
			else high = high?-14.5:-13;
			if (this.jump_buffer > 0 && this.jump_buffer < 18 && (this.jump_buffer < 7 || this.standing_surface != 2)){
				if (this.vy > high) this.vy = high;
				this.jump_buffer++;
				if (this.standing_surface == 2 && this.jump_buffer >= 7) this.jump_buffer = 18;
			}
		} else this.jump_buffer = 0;
		
		this.handle_y_collision();
		if (this.on_ground) this.refresh_crouch_state();
		if (this.crouch_state == 0) this.powerup_tick();
		if (!dirkeys.run) this.run_last++;
		this.collided_player = false;
	}
	powerup_tick(){
		if (this.state == 2){
			if (dirkeys.run && this.run_last > 1 && count_matching(ptentities, ent => ent.id == "flowerball" && ent.owner == this) < 3){
				obj = spawn_entity({id: "flowerball", x: 0, y: 0});
				obj.owner = this;
				obj.y = this.y+tilew*.9;
				obj.facing_left = !this.facing_left;
				if (obj.facing_left) obj.x = this.hbox_l;
				else obj.x = this.hbox_r-obj.hbox.w;
				obj.vy = 5;
				play_sound("fireball_shoot");
				this.action_anim = "fireball", this.anim_frame = 0;
				this.run_last = 0;
			}
		} else if (dirkeys.run && this.run_last > 0){
			this.run_last = 0;
		}
	}
	stomp(){
		this.vy = -15;
		if (dirkeys.jump) this.jump_buffer = 1;
	}
	drop(){this.vy = -10}
	get animation_prefix(){return this.character+"_"+Math.max(this.state, 0)+"_"}
	render(){
		if (ptvars.globalfreeze.id != null || this.cutscene.id != null){
			this.draw_sprite(this.animation_prefix+(this.last_anim || "walk"));
			return;
		}
		var s = "walk";
		if (this.crouch_state > 0) s = "crouch";
		else if (!this.on_ground){
			if (this.vy > 0) s = "fall";
			else s = "jump";
		}
		var ps = s;
		if (this.action_anim != null){
			s = this.action_anim;
			if (s == "fireball"){
				if (this.character == 0){
					if (ps == "jump") s = "fireball_jump";
				} else if (this.character == 1){
					if (ps == "walk" && dirkeys.right-dirkeys.left != 0) s = "fireball_walk";
					else if (ps == "jump") s = "fireball_jump";
					else if (ps == "fall") s = "fireball_fall";
				}
			}
		} else if (this.last_anim != s) this.anim_frame = 0;
		var anim = this.draw_sprite(this.animation_prefix+s);
		this.last_anim = ps;
		if (anim == null) return;
		if (this.action_anim == null){
			if (ps == "walk"){
				if (dirkeys.left-dirkeys.right != 0){
					if (anim.loop) this.anim_frame += dirkeys.run?.3:.2;
					else if (this.state > 0) this.anim_frame += dirkeys.run?.6:.4;
					else this.anim_frame += dirkeys.run?1.2:.8;
				} else if (anim.loop){
					if (this.vx == 0){
						var f = Math.floor(this.anim_frame%anim.frames);
						if (this.state > 0 && (f == 2 || f == 6)) this.anim_frame++;
					} else this.anim_frame += .1; // decrease animation speed when slow
				} else {
					if (this.anim_frame > anim.frames-1){
						this.anim_frame = anim.frames-1;
					} else if (this.anim_frame > 0){
						this.anim_frame -= .5;
					}
				}
			} else this.anim_frame += .5;
		} else {
			this.anim_frame += .5;
			if (Math.floor(this.anim_frame) > anim.frames-1){
				this.anim_frame = anim.setstart?0:maxint;
				this.action_anim = null;
			}
		}
	}
}

class Collectable extends EntityBase {
	constructor(ent, sprite, hitbox){
		super(ent, sprite, hitbox);
		if (hitbox == null) this.set_hitbox([8, 8, tilew-16, tilew-16]);
		this.despawn_distance = 3; // any lower will make it despawn instantly when loaded in
		this.remove_block_collision = true, this.remove_entity_collision = true;
		this.weight = 1;
		this.sound = "coin", this.particle = "sparkle";
		this.fallen = 0, this.switch_triggered = 0;
		this.give_to_main_player = true;
	}
	update(){
		if (this.idle_entity) return;
		if (this.cutscene.id == "coin_release"){
			if (this.cutscene.frame == 1) this.kill();
			else this.y -= 12*this.cutscene.top;
			return;
		}
		if (this.fallen > 0){
			if (this.on_ground) this.vx *= .8;
			this.handle_x_collision();
			this.handle_y_collision();
			if (this.flash_time == 0 && this.fallen == 2) this.kill();
		} else {
			this.check_bump_below();
		}
	}
	pre_despawn(){
		if (this.switch_triggered == 1) return false;
	}
	post_standing_terrain(){
		if (this.fallen == 0) return;
		this.vy = this.last_vy*-.5;
		if (Math.abs(this.vy) < 2) this.vy = 0;
		if (this.flash_state != -1){
			this.set_flash_state(-1, 5*60);
			this.fallen = 2;
		}
	}
	check_bump_below(){
		var x = this.hbox_l+this.hbox.w/2;
		if (x%tilew > 16 && x%tilew < 16) return;
		var block = point_collides_block(x, this.y+this.sprite.h+1, true);
		if (block != null && block.bumped > 0) this.collide_player(block.bumpedby);
		else {
			block = point_collides_block(this.hbox_l+this.hbox.w/2, this.hbox_t+this.hbox.h/2, true);
			if (block != null && block.bumped > 0) this.collide_player(block.bumpedby);
		}
	}
	collect_as(ply, item, count){
		if (this.give_to_main_player || !ply.is_player) ply = get_player_entity();
		if (ply == null){
			play_sound(this.sound);
			return 0;
		}
		var inv = ply.add_inventory(item, count);
		var life = false;
		if (item == "coin"){
			if (inv >= 100){
				inv = ply.add_inventory("coin", -100);
				ptvars.playerlives++;
				play_sound("extra_life");
				life = true;
			}
		} else if (entitydata[item].class == KeyCoin){
			ptvars.keycoins[get_config(this, "group")-1]--;
			var rem = ptvars.keycoins[get_config(this, "group")-1];
			if (rem <= 0){
				delete ply.inventory[item];
				if (rem == 0){
					ply.add_inventory("key");
					this.sound = "key";
				}
			}
		}
		var sp = drop_contents(this, ply, true, true);
		if (ply.can_interact && sp != NO_SOUND && !life) play_sound(this.sound);
		return inv;
	}
	collect(ply){
		this.collect_as(ply, this.id);
		this.respawn_id = "";
	}
	collide_player(ply){
		if (!ply.can_interact) return false;
		this.collect(ply);
		if (this.particle != null) spawn_particle_at_entity(this, this.particle);
		this.kill(ply);
		return false;
	}
	release(ply, top=1){
		if (this.cutscene.id != "pipe") this.y -= tilew*.75*top;
		this.facing_left = true;
		this.collect(ply);
		this.cutscene = {id: "coin_release", frame: 8, top: top};
		this.set_hitbox(null);
	}
	drop(ply){
		ply = nearest_player_to(this);
		if (ply != null) this.release(ply);
	}
	hit_by_projectile(ply, proj){
		if (proj == null) this.collide_player(ply);
		return false;
	}
	powwed(){
		if (this.fallen || this.idle_entity) return;
		this.remove_block_collision = false, this.remove_entity_collision = false;
		this.fallen = 1;
		this.vy = -10;
		if (Math.floor(Math.random()*2) < 1) this.vx = -2;
		else this.vx = 2;
	}
	static bg_layer = 5; // coin
}

class TimedCoin extends Collectable {
	constructor(ent, sprite){
		super(ent, sprite);
		this.particle = null;
	}
	pre_update(){
		if (get_config(this, "modifier") == 2) this.idle_entity = ptvars.pswitch <= 0;
	}
	collect(ply){
		this.collect_as(ply, "coin");
		this.respawn_id = "";
	}
}

class Key extends Collectable {
	constructor(ent, sprite){
		super(ent, sprite);
		this.sound = get_config(this, "bad")?"bad_key":"key";
		this.give_to_main_player = false;
	}
	update(){
		if (this.cutscene.id == "key_release"){
			if (this.cutscene.frame == 1) this.kill();
			else this.y -= (this.y-this.cutscene.target)/7;
		}
	}
	render(){
		if (this.cutscene.id != null || this.state < 0){
			this.draw_sprite();
			return;
		}
		var yofs = 2*Math.sin(this.anim_frame/3);
		this.draw_sprite(null, 0, yofs);
		if (ptvars.globalfreeze.id == null) this.anim_frame += .25;
	}
	collect(ply){
		this.collect_as(ply, "key", get_config(this, "bad")*-2+1);
		this.respawn_id = "";
	}
	release(ply, top=1){
		if (this.cutscene.id != "pipe") this.y -= 48*top;
		this.facing_left = true;
		this.collect(ply);
		this.cutscene = {id: "key_release", frame: 32, target: this.y-tilew*top, top: top};
		this.set_hitbox(null);
	}
	powwed(){}
}

class KeyCoin extends Collectable {
	constructor(ent, sprite){
		super(ent, sprite);
		this.sound = "key_coin", this.particle = null;
	}
}

class LargeCollectable extends Collectable {
	constructor(ent, sprite){
		super(ent, sprite, [8, 8, tilew*2-16, tilew*2-16]);
		this.sound = "large_coin";
	}
	collect(ply){
		var type = get_config(this, "type");
		if (type == 0) this.collect_as(ply, "coin", 10);
		else if (type == 1) this.collect_as(ply, "coin", 30);
		else if (type == 2) this.collect_as(ply, "coin", 50);
		else if (type == -1) this.collect_as(ply, "starcoin");
		this.respawn_id = "";
	}
	release(ply, top=1){
		if (this.cutscene.id != "pipe"){
			this.y -= tilew*1.25*top+tilew/2;
			this.x -= tilew/2;
		}
		this.facing_left = true;
		this.collect(ply);
		this.cutscene = {id: "coin_release", frame: 8, top: top};
		this.set_hitbox(null);
	}
}

class StompableEnemy extends EntityBase {
	constructor(ent, sprite, hitbox){
		super(ent, sprite, hitbox);
		if (hitbox == null) this.set_hitbox([8, 16, tilew-16, tilew-16]);
		this.obey_conveyor = true;
		this.walk_speed = 2, this.jump_height = 0;
		var dir = get_config(this, "direction");
		if (dir == 0) this.facing_left = true;
		else if (dir == 1) this.facing_left = false;
		else if (dir == 2){
			var p = get_player_entity();
			if (p == null || p.hbox == null) this.facing_left = true;
			else this.facing_left = this.hbox_l+this.hbox.w/2 >= p.hbox_l+p.hbox.w/2;
		} else if (dir == 3){
			this.walk_speed = 0, this.gravity = 0;
			this.remove_block_collision = true;
		}
	}
	walk(){
		this.vx *= .9;
		var dist = 0;
		if (this.x_freeze == 0){
			dist = this.walk_speed*(this.facing_left*-2+1);
			this.add_fvx(dist);
		}
		var col = this.handle_x_collision();
		this.set_fvx(dist, false);
		if (col > 0){ // hit wall
			this.facing_left = !this.facing_left;
		} else if (get_config(this, "smart") && this.air_tick == 0 && this.hbox != null){ // check if at end of platform
			var x = this.hbox_l, y = this.hbox_b+1;
			if (!this.facing_left) x += this.hbox.w;
			if (point_collides_block(x, y) == null) this.facing_left = !this.facing_left;
		}
		return col;
	}
	update(){
		this.walk();
		this.handle_y_collision();
	}
	post_standing_terrain(){
		if (this.jump_height != 0){
			this.vy = this.jump_height;
			this.handle_y_collision();
		}
	}
	pre_kill(ply){
		if (ply == null || ply.is_player){
			return drop_contents(this, ply);
		}
	}
	stomped(ply){
		if (this.hurt(ply) != NO_SOUND) play_sound("kill");
	}
	bump_below(ply){
		if (this.hurt(ply, false) != NO_SOUND) play_sound("kill");
	}
	collide_player(ply, stomp){
		if (this.star_killed(ply)) return;
		if (stomp){
			if (this.stomped(ply) !== false) ply.stomp(this);
		} else if (this.invincible == 0) ply.hurt();
	}
	turn(){ // when collided with another enemy
		this.facing_left = !this.facing_left;
		this.walk();
	}
	drop(ply){this.invincible = 3}
}

class Foppy extends StompableEnemy {
	constructor(ent, sprite){
		super(ent, sprite, [6, 16, tilew-12, tilew-16]);
		// this.global_stomp = 1;
	}
	// stomped(ply){
		// ply.simulate_bounce(this, 18);
		// return false;
	// }
}

class BlockHead extends StompableEnemy {
	constructor(ent, sprite){
		super(ent, sprite, [8, 6, tilew-16, tilew-6]);
		this.global_stomp = 1;
	}
	stomped(ply){
		ply.simulate_terrain(this);
		return false;
	}
}

class Bird extends StompableEnemy {
	constructor(ent, sprite){
		super(ent, sprite, [6, 18, tilew-12, tilew-26]);
		this.remove_block_collision = true, this.remove_entity_collision = true;
		this.despawn_distance = 3, this.gravity = 0;
		if (this.walk_speed != 0) this.walk_speed = 8;
		this.warn = -1, this.warn_timer = null;
	}
	update(){
		if (this.warn == -1){
			this.warn = 0;
			if (this.walk_speed != 0){
				if (this.facing_left && this.x+scrollx >= maxw) this.warn = 1;
				else if (!this.facing_left && this.x+this.sprite.w+scrollx <= 0) this.warn = 1;
			}
			if (this.warn == 1){
				this.warn_timer = ptvars.globaltimer;
				this.set_hitbox(null);
			}
		}
		if (this.warn == 0){
			this.walk();
			return;
		}
		if (this.facing_left) this.x = maxw-this.sprite.w-scrollx;
		else this.x = -scrollx;
		if (ptvars.globaltimer-this.warn_timer > 50){
			this.warn = 0;
			this.set_hitbox([6, 16, tilew-12, tilew-24]);
			var dist = (this.facing_left*2-1)*this.sprite.w;
			this.add_fvx(dist);
			this.anim_frame = 0;
		}
	}
	pre_despawn(start){
		if (start) return;
		this.kill();
		return false;
	}
	powwed(ent){
		if (this.warn == 0) this.kill(ent, 1);
	}
	render(){
		if (this.warn == 1){
			if (Math.floor((ptvars.globaltimer-this.warn_timer)/20)%2 != 1) this.draw_sprite("warn");
			this.last_anim = "warn";
		} else {
			this.draw_sprite();
			this.last_anim = null;
		}
		if (ptvars.globalfreeze.id == null) this.anim_frame += .25;
	}
}

class Buzzy extends StompableEnemy {
	constructor(ent, sprite){
		super(ent, sprite);
	}
	pre_kill(){}
	stomped(ply){
		if (this.kill(ply) != NO_SOUND) play_sound("kill");
		var obj = drop_tile_at_entity(this, {id: "buzzyshell", type: 1, conf: {}}, ply);
		obj.conf.contents = this.conf.contents;
		obj.invincible = 2;
	}
}

class Spiny extends StompableEnemy {
	constructor(ent, sprite){
		super(ent, sprite);
	}
	collide_player(ply){
		if (this.star_killed(ply)) return;
		ply.hurt(this);
	}
}

class Shell extends StompableEnemy {
	constructor(ent, sprite){
		super(ent, sprite);
		this.obey_conveyor = false;
		this.walk_speed = 0;
		this.kicked = false, this.last_touching_player = [null, -1, -1];
	}
	kick(ply, left, stomp=false){
		if (this.kicked) return;
		this.walk_speed = 13, this.facing_left = left;
		this.kicked = this.can_interact = this.projectile_type.projenemy = true;
		this.sprite.frames = 4;
		if (ply != null){
			this.last_touching_player = [ply, ptvars.globaltimer, ptvars.globaltimer];
			spawn_hit_particle(this, left, stomp);
			play_sound("kick");
		}
	}
	unkick(ply){
		if (!this.kicked) return;
		this.walk_speed = 0;
		this.kicked = this.can_interact = this.projectile_type.projenemy = false;
		this.sprite.frames = 1;
		if (ply != null) this.last_touching_player = [ply, ptvars.globaltimer, ptvars.globaltimer];
		play_sound("kill");
	}
	stomped(ply){this.unkick(ply)}
	bump_below(ply){this.vy = -17}
	collide_player(ply, stomp){
		if (this.invincible > 0) return;
		if (ply.is_player && this.last_touching_player[0] == ply && ptvars.globaltimer-this.last_touching_player[1] <= 1
				&& ptvars.globaltimer-this.last_touching_player[2] <= 8){
			this.last_touching_player[1] = ptvars.globaltimer;
			return;
		}
		this.last_touching_player[0] = null;
		if (this.kicked){
			if (this.star_killed(ply)) return;
			if (stomp){
				if (this.stomped(ply) !== false) ply.stomp(this);
			} else if (this.invincible == 0) ply.hurt();
		} else {
			if (stomp && get_config(this, "type") == 1){
				if (this.star_killed(ply)) return;
				ply.hurt();
			} else if (get_config(this, "wearable") && this.check_stomp(ply)){
				// wear
			} else {
				this.kick(ply, center_difference(this, ply) < 0, ply.check_stomp(this));
			}
		}
	}
}

class Skipper extends StompableEnemy {
	constructor(ent, sprite){
		super(ent, sprite);
		if (get_config(this, "fast")){
			this.jump_height = -12, this.gravity = 1;
		} else {
			this.jump_height = -15, this.gravity = .8;
		}
		this.no_movement = false;
		if (this.walk_speed == 0) this.no_movement = true;
		this.walk_speed = 0, this.remove_block_collision = false;
		this.jump_timer = 0, this.on_ground_last = false;
	}
	update(){
		var fast = get_config(this, "fast");
		if (this.on_ground && ptvars.globaltimer-this.jump_timer > (fast?8:40)){
			this.vy = this.jump_height;
		} else if (!this.on_ground && !this.no_movement) this.walk_speed = fast?7:5;
		this.on_ground_last = this.on_ground;
		this.walk();
		this.handle_y_collision();
		this.walk_speed = 0;
	}
	render(){
		if (this.on_ground){
			this.draw_sprite();
			this.last_anim = null;
			return;
		}
		if (this.vy > 2) this.anim_frame = 6;
		else if (this.vy > -2) this.anim_frame = 5;
		else if (this.vy > -6) this.anim_frame = 4;
		else if (this.vy > -8) this.anim_frame = 3;
		else if (this.vy > -10) this.anim_frame = 2;
		else if (this.vy > -12) this.anim_frame = 1;
		else this.anim_frame = 0;
		this.draw_sprite("jump");
		this.last_anim = "jump";
	}
	post_standing_terrain(){
		if (!this.on_ground_last) this.jump_timer = ptvars.globaltimer;
	}
}

class Powerup extends StompableEnemy {
	constructor(ent, sprite, hitbox){
		super(ent, sprite, hitbox);
		if (hitbox == null) this.set_hitbox([8, 8, tilew-16, tilew-8]);
		this.weight = 1;
		if (get_config(this, "progressive")){
			var p = get_player_entity();
			if (p != null && p.state < 1) this.set_id("mushroom");
		}
		if (this.walk_speed != 0){
			this.walk_speed = get_config(this, "speed");
			if (this.walk_speed == 0) this.facing_left = true;
		}
		this.jump_height = get_config(this, "jump");
		this.conf.revert = get_config(this, "revert");
		this.prev_hitbox = null, this.revert_hitbox = 0;
	}
	update(){
		if (this.revert_hitbox > 0){
			this.revert_hitbox--;
			if (this.revert_hitbox == 0){
				this.hbox = {...this.prev_hitbox};
				this.prev_hitbox = null;
			}
		}
		this.walk();
		this.handle_y_collision();
	}
	collect(ply){
		if (this.conf.type == null || ply.state >= this.conf.type){
			if (this.conf.type == 1 && this.conf.revert && ply.state > 1){
				ply.set_flash_state(ply.state, 30);
				ply.set_state(this.conf.type);
				play_sound("hurt");
			} else play_sound("powerup_small");
		} else {
			ply.set_flash_state(ply.state, 30);
			ply.set_state(this.conf.type);
			play_sound("powerup");
		}
		spawn_particle_at_entity(this, "powerup");
		if (this.conf.type > 1) ply.revert_state = get_config(this, "revert");
	}
	collide_player(ply){
		if (!ply.can_interact) return;
		this.collect(ply);
		this.kill(ply);
	}
	turn(){
		if (this.walk_speed != 0){
			this.facing_left = !this.facing_left;
			this.walk();
		}
	}
	drop(){
		this.prev_hitbox = {...this.hbox}, this.revert_hitbox = 2;
		this.set_hitbox([0, 0, tilew, tilew]);
	}
	bump_below(){this.vy = -10}
	hit_by_projectile(){return false}
	powwed(){}
}

class LifeMushroom extends Powerup {
	constructor(ent, sprite){
		super(ent, sprite);
	}
	collect(ply){
		ptvars.playerlives++;
		play_sound("extra_life");
		this.respawn_id = "";
	}
}

class InvincibilityStar extends Powerup {
	constructor(ent, sprite){
		super(ent, sprite);
		if (this.walk_speed != 0) this.gravity = .7;
	}
	collect(ply){
		ply.invincible = 30*60; // 30 seconds
		ply.overlay_effect = 1;
		ply.overlay_time = ply.invincible-60;
	}
}

class DoubleCherry extends Powerup {
	constructor(ent, sprite){
		super(ent, sprite);
	}
	collect(ply){
		play_sound("powerup_small");
		spawn_particle_at_entity(this, "smokepuffbig");
		obj = spawn_entity({id: "player", x: this.x/tilew, y: this.y/tilew, conf: {...ply.conf}});
		obj.facing_left = ply.facing_left, obj.gravity = ply.gravity;
		obj.set_state(ply.state);
		obj.drop(this);
	}
}

class Projectile extends EntityBase {
	constructor(ent, sprite, hitbox){
		super(ent, sprite, hitbox);
		if (hitbox == null) this.set_hitbox([0, 0, this.sprite.w, this.sprite.h]);
		this.projectile_type = {priority: 1, type: 1, passthrough: true};
		this.despawn_distance = 3;
		this.owner = null;
	}
	projectile_hit(ent){ // when this hits ent
		if (!this.projectile_type.passthrough) this.destroy();
	}
	destroy(){
		spawn_particle_at_entity(this, "smokepuff");
		this.kill();
	}
	powwed(ent){
		if (!this.owner.is_player) this.kill(ent, 1);
	}
}

class BouncingProjectile extends Projectile {
	constructor(ent, sprite){
		super(ent, sprite);
		this.projectile_type.passthrough = false;
		this.gravity = 1.2, this.weight = 0;
	}
	update(){
		this.vx = 11*(this.facing_left*-2+1);
		if (this.handle_x_collision() > 0){
			this.destroy();
			return;
		}
		if (this.handle_y_collision() > 0){
			if (!this.on_ground) this.destroy();
		}
	}
	post_standing_terrain(){
		this.vy = -12;
		this.y += this.vy;
	}
}

class BlockEntity extends EntityBase {
	constructor(ent, sprite, hitbox){
		super(ent, sprite, hitbox);
		if (hitbox == null){
			var w = get_config(this, "size"), h = 1;
			this.weight = 2*w;
			if (get_config(this, "vertical")) [w, h] = [h, w];
			this.set_hitbox([0, 0, w*tilew, h*tilew]);
		}
		this.global_stomp = 2, this.projectile_type.priority = -1;
		this.semisolid = false, this.pushable = false, this.grabbable = false;
		this.crushes = 2; // 0 = bounce, 1 = stay on top of player, 2 = crush, 3 = crush + priority
		if (get_config(this, "direction") == 3){
			this.gravity = 0, this.remove_block_collision = true;
		}
		if (get_config(this, "instant")) this.despawn_distance = 0;
	}
	update(){
		this.vx *= .9;
		if (Math.abs(this.vx) < 1) this.vx = 0;
		this.handle_x_collision();
		if (this.remove_block_collision) this.vy = 0;
		this.handle_y_collision();
	}
	pre_despawn(){
		if (get_config(this, "instant")) this.activate(get_player_entity());
	}
	handle_collision_events(ent, side, pre){
		if (pre){
			if (this.pre_collision(ent, side) === false || this.hbox == null) return false;
			if (ent.global_stomp > 1){
				if (side%2 == 0 && (ent.pre_collision(this, 2-side) === false || ent.hbox == null)) return false;
				else if (side%2 != 0 && (ent.pre_collision(this, 4-side) === false || ent.hbox == null)) return false;
			}
		} else {
			this.post_collision(ent, side);
			if (ent.global_stomp > 1){
				if (side%2 == 0) ent.post_collision(this, 2-side);
				else ent.post_collision(this, 4-side);
			}
		}
		return true;
	}
	entity_top(ent){
		if (!this.handle_collision_events(ent, 0, true)) return false;
		ent.simulate_terrain(this);
		this.handle_collision_events(ent, 0, false);
	}
	entity_side(ent, left){
		if (!this.handle_collision_events(ent, left?3:1, true)) return false;
		var stopent = true, stopthis = false;
		if (ent.global_stomp > 1){
			if (ent.crushes > this.crushes) stopent = false, stopthis = true;
		}
		if (!stopent && !stopthis) stopent = true;
		if (this.pushable){
			stopent = !stopent, stopthis = !stopthis;
			if (!stopent && !stopthis) stopent = stopthis = true;
		}
		if (left){
			if (stopent){
				ent.x = this.hbox_l-ent.hbox.x-ent.hbox.w;
				if (ent.vx > 0) ent.vx = 0;
				ent.turn();
				ent.set_fvx(this.vx+this.fixed_vx, false);
			}
			if (stopthis){
				this.x = ent.hbox_r-this.hbox.x;
				if (this.vx < 0) this.vx = 0;
				this.turn();
				this.set_fvx(ent.vx+ent.fixed_vx, false);
			}
		} else {
			if (stopent){
				ent.x = this.hbox_r-ent.hbox.x;
				if (ent.vx < 0) ent.vx = 0;
				ent.turn();
				ent.set_fvx(this.vx+this.fixed_vx, false);
				
			}
			if (stopthis){
				this.x = ent.hbox_l-this.hbox.x-this.hbox.w;
				if (this.vx > 0) this.vx = 0;
				this.turn();
				this.set_fvx(ent.vx+ent.fixed_vx, false);
			}
		}
		if (this.pushable && ent.can_interact) ent.vx *= .87;
		if (stopthis) this.handle_x_collision(false);
		if (stopent){
			ent.handle_x_collision(false);
			if (ent.is_player && ent.vy == 0){
				ent.y += ent.last_vy, ent.vy = ent.last_vy;
				ent.handle_y_collision(false);
			}
		}
		this.handle_collision_events(ent, left?3:1, false);
		return false;
	}
	entity_bottom(ent){
		if (!this.handle_collision_events(ent, 2, true)) return false;
		var ret = true;
		if (this.crushes == 0){ // bounce
			if (ent.is_player){
				this.vy = -10;
				this.handle_y_collision(false);
				if (this.hbox != null){
					if (ent.hbox_l < this.hbox_l){
						this.vx += 3;
						this.x += this.vx;
					} else if (ent.hbox_r > this.hbox_r){
						this.vx -= 3;
						this.x += this.vx;
					}
				}
			} else ret = false;
		} else if (this.crushes == 1){ // land on head
			if (ent.global_stomp > 1) this.simulate_terrain(ent);
			else if (ent.is_player) this.simulate_terrain(ent, false);
			else ret = ent.collide_player(this, true);
		} else if (this.crushes > 1){ // crush
			if (ent.global_stomp > 1){
				this.simulate_terrain(ent);
				if (this.crushes > 2) ent.activate(this);
			} else {
				ent.y = this.hbox_b-ent.hbox.y;
				ent.vy = (this.vy > 0)?this.vy:0;
				ent.set_fvy(this.fixed_vy, false);
				ent.y_freeze = 0;
				ent.jump_buffer = maxint;
				ent.handle_y_collision(true);
				ret = false;
			}
		} else { // collide
			ent.collide_player(this, true);
		}
		this.handle_collision_events(ent, 2, false);
		return ret;
	}
	entity_crush(ent){
		if (this.semisolid) return false;
		if (this.star_killed(ent)) return false;
		if (ent.projectile_type.priority > 0){
			ent.destroy();
		} else if (this.pushable){
			this.pre_crush(ent);
			this.hurt(ent, false, true);
		} else if (this.crushes == 0 && ent.is_player){
			this.entity_bottom(ent);
		} else {
			if (ent.global_stomp > 1) ent.pre_crush(this);
			ent.hurt(this, false, true);
		}
	}
	collide_player(ply, stomp){
		if (ply.cutscene.id != null) return false;
		var plyblock = ply.global_stomp > 1;
		if (this.semisolid){
			if (stomp) return this.entity_top(ply);
			return this.entity_crush(ply);
		} else if (plyblock && ply.semisolid){
			if (this.check_stomp(ply)) return ply.entity_top(this);
			return ply.entity_crush(this);
		}
		if (plyblock){
			if (ply.crushes > 2){
				this.activate(ply);
				if (this.hbox == null) return false;
			} else if (this.crushes > 2){
				ply.activate(this);
				if (ply.hbox == null) return false;
			}
		}
		var vel = ply.vx+ply.fixed_vx-this.vx-this.fixed_vx; // x velocity threshold
		if (stomp){
			var overlap = ply.hbox_b-this.hbox_t;
			if (overlap < ply.last_vy){
				if (ply.hbox_r < this.hbox_l+vel*2){
					if (ply.hbox_r-this.hbox_l-overlap < -.5 && ply.hbox_r-this.hbox_l <= vel*2) stomp = false;
				} else if (ply.hbox_l > this.hbox_r+vel*2){
					if (this.hbox_r-ply.hbox_l-overlap < -.5 && this.hbox_r-ply.hbox_l <= -vel*2) stomp = false;
				}
			}
		}
		if (stomp) return this.entity_top(ply); // top
		if (ply.hbox_r-this.hbox_l-Math.max(ply.vx+ply.fixed_vx, 0)+Math.min(this.last_vx, 0) < .1){ // left
			return this.entity_side(ply, true);
		}
		if (this.hbox_r-ply.hbox_l+Math.min(ply.vx+ply.fixed_vx, 0)-Math.max(this.last_vx, 0) < .1){ // right
			return this.entity_side(ply, false);
		}
		if (this.check_stomp(ply)){ // bottom
			if (plyblock) return ply.entity_top(this);
			return this.entity_bottom(ply);
		}
		if (plyblock){
			if (this.remove_block_collision || ply.remove_block_collision || ply.semisolid) return false;
			if (ply.crushes == 0 || ply.crushes > 2) return ply.entity_crush(this);
		}
		return this.entity_crush(ply);
	}
	activate(){}
	collision_hitbox_intersects_entity(ent){
		if (this.hbox == null || ent.hbox == null) return false;
		if (this.vy+this.fixed_vy == 0) return this.hitbox_intersects_entity(ent);
		var h = null;
		if (ent.can_interact || ptvars.globaltimer-this.stepped_frames > this.step_requirement){ // for falling blocks
			h = this.with_hitbox([this.hbox.x, this.hbox.y-this.vy-this.fixed_vy, this.hbox.w, this.hbox.h+this.vy+this.fixed_vy]);
		}
		return this.hitbox_intersects_entity(ent, h);
	}
	hit_by_projectile(ply, proj=null){
		if (proj == null) proj = ply;
		if (proj.check_stomp(this)) this.collide_player(proj, true);
		else this.entity_crush(proj);
		return false;
	}
	release(ply, top=1, pipe=false){
		this.last_vy = -this.sprite.h/(pipe?16:8)*top;
		this.set_fvy(this.last_vy, false);
		this.y += this.vy;
		if (pipe){
			this.cutscene = {id: "release", frame: 15, top: top};
		} else {
			this.cutscene = {id: "jump_release", frame: 7, top: top};
			play_sound("block_release");
		}
	}
	bump_below(){this.vy = -14}
	pre_collision(ent, side){} // before colliding with ent
	post_collision(ent, side){} // after colliding with ent
	powwed(){}
	static bg_layer = 1; // blockentity
}

class Crate extends BlockEntity {
	constructor(ent, sprite){
		super(ent, sprite);
		this.weight = 1;
		this.pushable = true, this.crushes = 1;
	}
	pre_kill(ply){
		if (ply == null || ply.is_player){
			return drop_contents(this, ply);
		}
	}
}

class BoomBlock extends BlockEntity {
	constructor(ent, sprite){
		super(ent, sprite);
		this.crushes = 0;
	}
	pre_collision(ent, side){
		if (!ent.can_interact) return;
		if (side == 2 && ent.vy < 0){
			ent.y = this.hbox_b-ent.hbox.y;
			if (ent.vy < 0) ent.vy *= -.1;
			ent.jump_buffer = maxint;
			this.activate(ent);
		}
	}
	bump_below(ent){this.activate(ent)}
	activate(activator){
		if (get_config(this, "type") > 0) spawn_particle_at_entity(this, "boom"+(get_config(this, "type")+1));
		else spawn_particle_at_entity(this, "boom");
		this.kill(activator);
		var type = get_config(this, "type");
		if (type == 0) trigger_pow(activator);
		else if (type == 1) trigger_pow(activator, true);
		drop_contents(this, activator);
	}
}

class StepSwitch extends BlockEntity {
	constructor(ent, sprite){
		super(ent, sprite, [2, 8, tilew-4, tilew-8]);
		if (!this.remove_block_collision) this.crushes = 0;
	}
	pre_crush(ply){
		if (ply == null) ply = get_player_entity();
		this.activate(ply);
	}
	post_collision(ply, side){
		if (side != 0 || ply instanceof StepSwitch || ply.weight < 2) return;
		this.activate(ply, true);
	}
	drop(ply){
		if (this.collision_hitbox_intersects_entity(ply)) this.activate(ply);
	}
	activate(activator, step=false){
		if (step) this.hurt(activator);
		else this.kill(activator);
		trigger_pswitch();
		drop_contents(this, activator);
	}
}

class Muncher extends BlockEntity {
	constructor(ent, sprite){
		super(ent, sprite);
		this.crushes = 2;
	}
	post_collision(ent){
		if (ent.is_player) ent.hurt(this, false);
	}
	powwed(ent){this.kill(ent, 1)}
}

class Crusher extends BlockEntity {
	constructor(ent, sprite){
		super(ent, sprite);
		if (get_config(this, "spikeless")) this.set_hitbox([12, 4, tilew*2-24, tilew*2-8]);
		else this.set_hitbox([16, 6, tilew*2-32, tilew*2-12]);
		this.gravity = 0, this.remove_block_collision = false;
		this.crushes = 3;
		this.can_interact = true;
		this.dir = get_config(this, "direction");
		var fast = tilew*(get_config(this, "fast")?31:13);
		this.detection_hitbox = null;
		if (this.dir == 2) this.detection_hitbox = [-tilew, tilew+2, tilew*4, fast];
		else if (this.dir == 0) this.detection_hitbox = [-tilew, tilew-2-fast, tilew*4, fast];
		else if (this.dir == 1) this.detection_hitbox = [tilew+2, -tilew, fast, tilew*4];
		else if (this.dir == 3) this.detection_hitbox = [tilew-2-fast, -tilew, fast, tilew*4];
		this.phase = 0; // 0 = idle, 1 = going down, 2 = going up
		this.phase_timer = null;
		if (this.dir%2 == 0) this.reverse_target = this.hbox_t;
		else this.reverse_target = this.hbox_l;
	}
	update(){
		this.gravity = 0;
		if (this.phase == 1 && this.phase_timer == null){
			var fast = get_config(this, "fast")*.7+1;
			if (this.dir == 2) this.gravity = 1.2*fast;
			else if (this.dir == 0) this.gravity = -1.2*fast;
			else if (this.dir == 1) this.vx += 1.4*fast;
			else if (this.dir == 3) this.vx -= 1.4*fast;
		}
		var diff = 0;
		if (this.phase == 2){ // retreating
			var fast = get_config(this, "fast")*2+3;
			if (this.dir%2 == 0){
				diff = this.hbox_t-this.reverse_target;
				if (Math.abs(diff) <= fast){
					this.vy = 0;
					this.phase = 0, this.phase_timer = ptvars.globaltimer;
				} else {
					diff = diff/Math.abs(diff)*fast;
				}
				this.set_fvy(-diff);
			} else {
				diff = this.hbox_l-this.reverse_target;
				if (Math.abs(diff) <= fast){
					this.vx = 0;
					this.phase = 0, this.phase_timer = ptvars.globaltimer;
				} else {
					diff = diff/Math.abs(diff)*fast;
				}
				this.set_fvx(-diff);
			}
		}
		
		this.vx *= .9;
		if (Math.abs(this.vx) < 1) this.vx = 0;
		var hitx = this.handle_x_collision() > 0;
		var hity = this.handle_y_collision() > 0;
		if (this.hbox == null) return;
		
		if (this.dir%2 == 0) this.set_fvy(-diff, false);
		else this.set_fvx(-diff, false);
		if (this.phase == 1){ // crushing
			if (this.phase_timer == null){
				if ((this.dir%2 == 0 && hity) || (this.dir%2 == 1 && hitx)) this.hit_target();
			} else if (ptvars.globaltimer-this.phase_timer > 10){
				this.phase++;
				this.phase_timer = null;
			}
		}
		this.check_bump_below();
	}
	hit_target(){
		var sp = null, sp2 = null;
		if (this.dir == 2){
			sp = activate_block_at_point(this.hbox_l+this.hbox.w/3, this.hbox_b+2, this, false);
			sp2 = activate_block_at_point(this.hbox_l+(this.hbox.w/3)*2, this.hbox_b+2, this, false);
		} else if (this.dir == 0){
			sp = activate_block_at_point(this.hbox_l+this.hbox.w/3, this.hbox_t-2, this);
			sp2 = activate_block_at_point(this.hbox_l+(this.hbox.w/3)*2, this.hbox_t-2, this);
		} else if (this.dir == 1){
			sp = activate_block_at_point(this.hbox_r+2, this.hbox_t+this.hbox.h/3, this);
			sp2 = activate_block_at_point(this.hbox_r+2, this.hbox_t+(this.hbox.h/3)*2, this);
		} else if (this.dir == 3){
			sp = activate_block_at_point(this.hbox_l-2, this.hbox_t+this.hbox.h/3, this);
			sp2 = activate_block_at_point(this.hbox_l-2, this.hbox_t+(this.hbox.h/3)*2, this);
		}
		if (sp != NO_SOUND && sp2 != NO_SOUND) play_sound("thump");
		var stopped = true;
		if (get_config(this, "fast")){
			stopped = false;
			if (this.dir%2 == 0){
				var prev = this.y;
				this.y += (this.dir == 2)*4-2;
				if (this.handle_y_collision(false) > 0) stopped = true;
				this.y = prev, this.vy = 0;
			} else {
				var prev = this.x;
				this.x += (this.dir == 1)*4-2;;
				if (this.handle_x_collision(false) > 0) stopped = true;
				this.x = prev, this.vx = 0;
			}
		}
		if (stopped){
			this.phase_timer = ptvars.globaltimer;
			if (this.dir%2 == 0) this.vy = 0;
			else this.vx = 0;
		}
	}
	check_bump_below(){
		var block = point_collides_block(this.hbox_l+this.hbox.w/2, this.hbox_b+8, true);
		if (block != null && block.bumped > 0 && this.phase != 1){
			drop_contents(this, block.bumpedby);
			this.kill(block.bumpedby, 1);
		}
	}
	pre_collision(ent){
		if (this.hitbox_intersects_entity(ent)) return;
		if (this.phase == 0){ // player in detection zone
			if (this.phase_timer != null && ptvars.globaltimer-this.phase_timer < 10) return false;
			this.phase = 1, this.phase_timer = null;
		}
		return false;
	}
	post_collision(ent){
		if (ent.is_player && !get_config(this, "spikeless")) ent.hurt(this, false);
	}
	collision_hitbox_intersects_entity(ent){
		if (this.hbox == null || ent.hbox == null) return false;
		if (!ent.is_player || this.phase != 0) return this.hitbox_intersects_entity(ent);
		return this.hitbox_intersects_entity(ent, this.with_hitbox(this.detection_hitbox));
	}
	render(){
		var s = (this.phase == 1)?"angry":null;
		this.draw_sprite(s, 0, 0);
		this.last_anim = s;
	}
}

class Spring extends BlockEntity {
	constructor(ent, sprite){
		super(ent, sprite);
		this.crushes = 0;
		this.bouncing = 0;
		this.sideways = !get_config(this, "vertical");
		if (this.sideways) this.set_hitbox([4, 0, tilew-8, tilew]);
		else this.set_hitbox([0, 1, tilew, tilew-1]);
		if (this.remove_block_collision) this.semisolid = true;
	}
	pre_update(){
		if (this.bouncing > 0 && Math.floor(this.anim_frame) == 3){
			this.bouncing = -1;
			if (!this.sideways) this.set_hitbox([0, 1, tilew, tilew-1]);
		} else if (this.bouncing < 0) this.bouncing++;
	}
	entity_top(ent){
		if (this.sideways){
			ent.simulate_terrain(this);
			return;
		}
		if (this.bouncing != 0 && Math.floor(this.anim_frame) < 2){
			if (get_config(this, "high")) ent.simulate_bounce(this, ent.is_player?25:32, 19);
			else ent.simulate_bounce(this, ent.is_player?20:25, 12);
			ent.x_freeze = 1;
			if ((this.on_ground || this.remove_block_collision) && this.bouncing > 0) ent.y_freeze = 4;
		} else {
			this.bounce(ent);
			return false;
		}
	}
	entity_bottom(ent){
		if (!this.sideways) return false;
		this.bounce(ent);
		return false;
	}
	pre_collision(ent, side){ // will only run for sides because other functions are overwritten
		if (!this.sideways) return false;
		this.bounce(ent);
		return false;
	}
	bounce(ent){
		if (this.sideways){
			var diff = center_difference(ent, this);
			var left = point_collides_block(this.x-8, this.hbox_t+4, false, true) != null ||
				point_collides_block(this.x-8, this.hbox_b-4, false, true) != null;
			var right = point_collides_block(this.x+tilew+8, this.hbox_t+4, false, true) != null ||
				point_collides_block(this.x+tilew+8, this.hbox_b-4, false, true) != null;
			if (left && !right) diff = 1;
			else if (right && !left) diff = -1;
			var vel = 100;
			if (!get_config(this, "high")){
				vel = 20;
				if (this.is_player) vel *= 1.5;
			}
			
			ent.vx = this.fixed_vx;
			if (diff > 0){ // ent on right
				ent.vx += vel;
				if (ent.facing_left) ent.turn();
			} else { // ent on left
				ent.vx -= vel;
				if (!ent.facing_left) ent.turn();
			}
			if (this.bouncing == 0) play_sound("bounce");
			if (ent.is_player){
				ent.standing_surface = 0;
				ent.refresh_crouch_state();
			} else if (ent.on_ground){
				ent.vy = -13;
			}
			if (ent instanceof Shell) ent.kick(null, ent.facing_left);
		} else {
			if (this.bouncing > 0 && ent.hbox_b > this.hbox_t) return;
			this.set_hitbox([0, tilew/2, tilew, tilew/2]);
			ent.x_freeze = 6;
			if (ent.vy < 20) ent.vy = 20;
		}
		this.bouncing = 1, this.anim_frame = 0;
	}
	entity_crush(ent){
		if (this.sideways){
			this.bounce(ent);
		} else if (this.semisolid){
			if (this.bouncing < 0 && ent.check_stomp(this.with_hitbox([0, tilew/2, tilew, tilew/2]))){
				if (ent.y_freeze > 0) ent.y_freeze = 0;
				else this.entity_top(ent);
			}
		} else if (ent instanceof Spring){
			if (this.hbox_b-ent.hbox_t <= tilew/2) return ent.entity_top(this);
			return this.entity_top(ent);
		}
		return false;
	}
	pre_kill(){this.bouncing = 0}
	render(){
		if (this.bouncing > 0){
			this.draw_sprite("bounce");
			this.last_anim = "bounce";
			if (ptvars.globalfreeze.id == null){
				if (this.sideways){
					this.anim_frame++;
				} else {
					if (Math.floor(this.anim_frame) == 1) this.anim_frame += .2;
					else if (Math.floor(this.anim_frame) > 1) this.anim_frame += .5;
					else this.anim_frame++;
				}
			}
		} else {
			this.draw_sprite();
			this.last_anim = null;
		}
	}
	static bg_layer = 2;
}

class FallingBlock extends BlockEntity {
	constructor(ent, sprite){
		super(ent, sprite);
		this.stepped_frames = ptvars.globaltimer, this.stepped_last = -1;
		this.gravity = 0;
		this.restore_id = this.id, this.step_requirement = 60;
		this.spawnx = this.x, this.spawny = this.y;
		this.crushes = 2;
	}
	met_step_requirement(){
		this.set_fvy(8);
		if (this.handle_x_collision() > 0 || this.handle_y_collision() > 0) this.kill_and_respawn();
	}
	kill_and_respawn(){
		this.idle_entity = true;
		this.stepped_frames = ptvars.globaltimer, this.stepped_last = -2;
	}
	update(){
		if (this.despawn_distance <= 0) return;
		this.set_fvy(0);
		if (this.stepped_last < -1){
			if (ptvars.globaltimer-this.stepped_frames > 60*5){
				set_playtest_tile(this.spawnx/tilew, this.spawny/tilew, {id: this.restore_id, type: 0});
				this.kill();
			}
			return;
		}
		if (ptvars.globaltimer-this.stepped_frames > this.step_requirement){
			this.met_step_requirement();
			if (this.y > ptvars.levelh+this.sprite.h) this.kill_and_respawn();
		} else if (this.stepped_last == 0){
			set_playtest_tile(this.x/tilew, this.y/tilew, {id: this.restore_id, type: 0});
			this.despawn_distance = -1; // kill next frame
		}
		if (this.stepped_last >= -1) this.stepped_last = 0;
	}
	entity_top(ent){
		ent.simulate_terrain(this);
		if (ent.can_interact) this.stepped_last = 1;
		return false;
	}
	collision_hitbox_intersects_entity(ent){
		if (this.hbox == null || ent.hbox == null) return false;
		if (ent.vy >= 0){
			if (this.last_vy > 0){
				return this.hitbox_intersects_entity(ent, this.with_hitbox([0, -8, tilew, tilew+8])); // snap to falling platform
			} else if (ent.can_interact && ent.global_stomp < 2){
				return this.hitbox_intersects_entity(ent, this.with_hitbox([0, -2, tilew, tilew+2])); // make sure step timer keeps running
			}
		}
		return this.hitbox_intersects_entity(ent);
	}
	render(){
		if (ptvars.globaltimer-this.stepped_frames > this.step_requirement) this.draw_sprite();
		else this.draw_sprite(null, Math.random()*2-1, Math.random()*2-1);
	}
}

class InstantFallingBlock extends FallingBlock {
	constructor(ent, sprite){
		super(ent, sprite);
		this.remove_block_collision = true, this.semisolid = true;
		this.restore_id = "sand", this.step_requirement = 0;
		this.wait_frames = ptvars.globaltimer;
	}
	met_step_requirement(){
		if (ptvars.globaltimer-this.wait_frames > 8) this.set_fvy(8);
		this.handle_x_collision();
		this.handle_y_collision();
	}
	kill_and_respawn(){
		this.kill(); // don't respawn
	}
}

class CustomizableBlock extends EntityBase {
	constructor(ent, sprite){
		super(ent, sprite);
		this.despawn_distance = 0; // despawn/kill instantly
	}
	pre_despawn(){
		var id = this.create_from_config();
		var x = Math.floor(this.x/tilew), y = Math.ceil(this.y/tilew);
		set_playtest_tile(x, y, {id: id, type: 0}, true);
		if (this.conf.contents != null) ptblocks[x][y].contents.push({...this.conf.contents});
	}
	create_from_config(c){
		if (c == null) c = this;
		var id = "custom_", id2 = "", spriteid = "customblock";
		id2 += get_config(c, "hurts");
		id2 += get_config(c, "semisolid");
		id2 += +get_config(c, "playerpass");
		id2 += +get_config(c, "entitypass");
		id += id2;
		id += get_config(c, "surface");
		id += get_config(c, "destroyable");
		id += +get_config(c, "hidden");
		id += +get_config(c, "infcontents");
		if (!(id in blockdata)){
			if (id2[1] == 1) spriteid = "onewaytop";
			else if (id2[1] == 2) spriteid = "onewaybottom";
			else if (id2[1] == 3) spriteid = "onewayleft";
			else if (id2[1] == 4) spriteid = "onewayright";
			else if (id2[0] > 0) spriteid = "spiketrap";
			if (id2.slice(1) == "001"){
				if (id2 == "0001") spriteid = "playerblock";
				else if (id2 == "0101") spriteid = "playersemisolid";
				else if (id2[0] > 0) spriteid = "playerspikes";
			} else if (id2.slice(1) == "010"){
				if (id2 == "0010") spriteid = "entityblock";
				else if (id2 == "0110") spriteid = "entitysemisolid";
				else if (id2[0] > 0) spriteid = "entityspikes";
			}
			var props = {...c.conf};
			delete props.contents;
			delete props.inblock;
			if (get_config(c, "hidden")){
				var c2 = {...c};
				c2.conf.hidden = false;
				props.semisolid = 0, props.destroyable = 0;
				props.bumpto = this.create_from_config(c2);
			} else if (get_config(c, "destroyable") == 1 || c.conf.contents != null){
				props.bumpto = id;
			}
			var d = blockdata[spriteid];
			var tile = {x: d.x, y: d.y, w: tilew, h: tilew, collision: [0, 0, 1, 1],
				loop: true, limit: 0, hascontents: false, props: props
			};
			if (d.frames != null && d.frames > 1){
				tile.frames = d.frames, tile.framespeed = d.framespeed;
			}
			blockdata[id] = tile;
		}
		return id;
	}
	render(){}
}

class BackgroundNPC extends EntityBase {
	constructor(ent, sprite, hitbox){
		super(ent, sprite, hitbox);
		if (hitbox == null) this.set_hitbox([8, 8, tilew-16, tilew-16]);
		this.despawn_distance = 3;
		this.remove_block_collision = true, this.remove_entity_collision = true;
		this.weight = 0;
		this.showing_message = false;
		this.message = get_config(this, "message").split("\n");
		this.font = get_config(this, "font");
		if (this.font > indexedfonts.length) this.font = 0;
		this.font = indexedfonts[this.font];
		this.metrics = {w: 0, h: 0, lineh: 0};
		ctx.font = "bold 24px "+this.font;
		for (var ln of this.message){
			var m = ctx.measureText(ln);
			var h = m.fontBoundingBoxAscent+2;
			if (m.width > this.metrics.w) this.metrics.w = m.width;
			if (h > this.metrics.lineh) this.metrics.lineh = h;
			this.metrics.h += h;
		}
		if (this.message.length == 0 || this.message[0] == null || this.message[0] == "") this.message = null;
		this.gift_icon = null;
		if (this.conf.contents != null && !get_config(this, "background")){
			this.gift_icon = {...this.conf.contents};
			delete this.gift_icon.conf;
			this.metrics.w += 26, this.metrics.h += 20;
		}
		this.gift_player = null;
		var c = get_config(this, "colorset");
		if (c == 0) this.colorset = ["black", "white"];
		else if (c == 1) this.colorset = ["white", "black"];
		else if (c == 2) this.colorset = ["#db8", "black"];
		else if (c == 3) this.colorset = ["black", "limegreen"];
		else if (c == 4) this.colorset = ["#f8f", "#7f8"];
	}
	update(){
		if (this.showing_message){
			this.showing_message = false;
			if (this.gift_player != null){
				drop_contents(this, this.gift_player);
				this.gift_player = null;
			}
		}
	}
	player_interact(ply){
		if (dirkeys.interact != 1 || get_config(this, "background")) return;
		if (this.message == null){
			drop_contents(this, ply);
		} else {
			this.showing_message = true;
			this.gift_player = ply;
			set_global_freeze({id: "message", released: 0, drawfunc: this.draw_message.bind(this)});
			play_sound("message");
		}
		return false; // override jump
	}
	collide_player(ply){
		if (!ply.is_player || !get_config(this, "background")) return false;		
		drop_contents(this, ply);
		if (ptvars.playing) this.showing_message = true;
		return false;
	}
	render(){
		this.draw_sprite();
		this.last_anim = null;
		if (!this.showing_message || ptvars.globalfreeze.id == "message") return;
		this.draw_message(true);
	}
	draw_message(outline=false){
		if (this.message == null) return;
		ctx.font = "bold 24px "+this.font;
		var x = this.x+this.sprite.w/2+scrollx, y = this.y-100-this.metrics.h+scrolly;
		ctx.fillStyle = this.colorset[0], ctx.strokeStyle = this.colorset[1], ctx.lineWidth = 4;
		if (!outline){
			rounded_rect(x-this.metrics.w/2-15, y-15, this.metrics.w+30, this.metrics.h+30, 10);
			ctx.fill();
			ctx.stroke();
		}
		ctx.fillStyle = this.colorset[1], ctx.strokeStyle = this.colorset[0], ctx.lineWidth = 8;
		ctx.textAlign = "center";
		var ny = y+this.metrics.lineh-2;
		if (this.gift_icon != null) x -= 4;
		for (var ln of this.message){
			if (outline) ctx.strokeText(ln, x, ny);
			ctx.fillText(ln, x, ny);
			ny += this.metrics.lineh;
		}
		if (this.gift_icon != null){
			var d = get_sprite_data(this.gift_icon, true);
			var s = blocksheet;
			if (this.gift_icon.type == 1) s = entitysheet;
			ctx.drawImage(s, d.x, d.y, d.w, d.h, this.x+this.sprite.w/2+this.metrics.w/2-18+scrollx, y+this.metrics.h-18, 26, 26);
		}
	}
	static bg_layer = 10; // sign
}

class PipeWarp extends EntityBase {
	constructor(ent, sprite, hitbox){
		super(ent, sprite, hitbox);
		this.despawn_distance = 3;
		this.remove_block_collision = true, this.remove_entity_collision = true;
		this.dir = get_config(this, "direction"), this.size = get_config(this, "size");
		this.do_drop = null;
		if (hitbox == null){
			if (this.size == 1){
				if (this.dir == 0) this.set_hitbox([tilew-12, 0, 24, 2]);
				else if (this.dir == 2) this.set_hitbox([tilew-12, tilew-2, 24, 2]);
				else if (this.dir == 1) this.set_hitbox([tilew-2, tilew+1, 2, tilew-2]);
				else if (this.dir == 3) this.set_hitbox([0, tilew+1, 2, tilew-2]);
			} else if (this.size == 0){
				if (this.dir == 0) this.set_hitbox([1, 0, tilew-2, 2]);
				else if (this.dir == 2) this.set_hitbox([1, tilew-2, tilew-2, 2]);
				else if (this.dir == 1) this.set_hitbox([tilew-2, 1, 2, tilew-2]);
				else if (this.dir == 3) this.set_hitbox([0, 1, 2, tilew-2]);
			}
		}
	}
	update(){
		if (this.do_drop == ptvars.globaltimer){
			drop_contents(this);
			this.do_drop = null;
		}
	}
	collide_player(ply){
		var t = get_config(this, "target");
		if (t == null || t == "" || !ply.is_player || ply.cutscene.id != null) return false;
		if (!((this.dir == 0 && dirkeys.up) || (this.dir == 2 && dirkeys.down) ||
				(this.dir == 1 && dirkeys.right && ply.on_ground && ply.facing_left) ||
				(this.dir == 3 && dirkeys.left && ply.on_ground && !ply.facing_left))){
			return false;
		}
		if (this.size == 0 && this.dir%2 == 0 && (ply.hbox_l < this.hbox_l || ply.hbox_r > this.hbox_r)) return false;
		ply.last_anim = "walk", ply.jump_buffer = maxint;
		ply.cutscene = {id: "pipe", frame: 29, dir: this.dir, entering: true};
		if (this.dir == 2){
			ply.crouch_state = 0;
			ply.set_state(ply.state);
			ply.cutscene.cutoff = this.y+tilew;
			ply.y = this.y+tilew-ply.hbox.y-ply.hbox.h;
		} else if (this.dir == 0){
			ply.cutscene.cutoff = this.y;
			ply.y = this.y-ply.hbox.y;
		} else if (this.dir == 1){
			ply.cutscene.cutoff = this.x+tilew;
			ply.x = this.x+tilew-ply.hbox.x-ply.hbox.w;
			ply.anim_frame = 0;
		} else if (this.dir == 3){
			ply.cutscene.cutoff = this.x;
			ply.x = this.x-ply.hbox.x;
			ply.anim_frame = 0;
		}
		set_global_freeze({id: get_config(this, "revert")?"fade":"nofade", ontransition: this.transition.bind(this)});
		return false;
	}
	transition(){
		var dest = {x: this.x+tilew/2, y: this.y+tilew/2, dir: this.dir, area: prefs.area};
		var t = get_config(this, "target");
		var warp = levelsettings.warps.find(w => w.name == t && w.type == 1);
		if (warp != null) dest = {...warp, x: warp.x*tilew, y: warp.y*tilew, area: warp.area};
		var players = 0;
		reload_area(dest.area, get_config(this, "revert"), function(ply){
			ply.last_anim = "walk", ply.anim_frame = 0, ply.air_tick = maxint;
			ply.vx = 0, ply.vy = 0, ply.last_vx = 0, ply.last_vy = 0;
			ply.set_fvx(0); ply.set_fvy(0);
			ply.cutscene = {id: "pipe", frame: 29+players*20+10, dir: dest.dir};
			if (dest.dir%2 == 0){
				ply.x = dest.x-ply.hbox.x-ply.hbox.w/2;
				if (dest.size == 1) ply.x += tilew/2;
				ply.cutscene.cutoff = dest.y;
				if (dest.dir == 2){
					ply.y = dest.y+tilew*((ply.state > 0)?.5:1);
					ply.cutscene.cutoff += tilew/2;
				} else {
					ply.y = dest.y-tilew*((ply.state > 0)?2.5:3);
					ply.cutscene.cutoff -= tilew/2;
				}
			} else {
				ply.y = dest.y+tilew/2-ply.hbox.y-ply.hbox.h;
				if (dest.size == 1) ply.y += tilew;
				ply.cutscene.cutoff = dest.x;
				if (dest.dir == 3){
					ply.x = dest.x-tilew-ply.hbox.x-ply.hbox.w;
					ply.cutscene.cutoff -= tilew/2;
					ply.facing_left = true;
				} else {
					ply.x = dest.x+tilew-ply.hbox.x;
					ply.cutscene.cutoff += tilew/2;
					ply.facing_left = false;
				}
			}
			players++;
		});
		if (warp != null){
			var ent = ptentities.find(e => e instanceof PipeWarp && get_config(e, "name") == t);
			if (ent != null) ent.do_drop = ptvars.globaltimer;
		} else {
			this.do_drop = ptvars.globaltimer;
		}
	}
	render(){}
	powwed(){}
	static editor_shift(ent, action, prev, cur){
		editor_warp_shift(ent, action, prev, cur, 1);
	}
}

class Door extends EntityBase {
	constructor(ent, sprite, hitbox){
		super(ent, sprite, hitbox);
		if (hitbox == null) this.set_hitbox([tilew/2-12, tilew*2-2, 24, 2]);
		this.despawn_distance = 3;
		this.remove_block_collision = true, this.remove_entity_collision = true;
		this.opening = 0, this.do_drop = null, this.open_player = null;
		this.update();
	}
	update(){
		if (this.do_drop == ptvars.globaltimer){
			drop_contents(this);
			this.do_drop = null;
		}
		if (get_config(this, "modifier") == 2) this.idle_entity = ptvars.pswitch <= 0;
	}
	unlock(check=false, limit=false){
		if (get_config(this, "modifier") != 1) return false;
		var id = "door"+(get_config(this, "type")+1)+"unlocked";
		if (this.id == id) return false;
		if (!check){
			this.set_id(id, true);
			spawn_particle({id: "stars", x: this.x+this.sprite.w/2, y: this.y-4});
			if (!limit){ // update target door
				var ent = ptentities.find(e => get_config(e, "name") == get_config(this, "target"));
				if (ent != null && get_config(ent, "target") == get_config(this, "name")) ent.unlock(false, true);
			}
		}
		return true;
	}
	player_interact(ply){
		var t = get_config(this, "target");
		if (t == null || t == "") return;
		if (this.unlock(true)){ // locked door
			if (ply.get_inventory("key") < 1){
				if (dirkeys.interact == 1) play_sound("no_key");
				return false;
			}
			if (dirkeys.interact != 1) return;
			ply.add_inventory("key", -1);
			this.unlock();
			this.open_player = ply;
			play_sound("unlock");
			set_global_freeze({id: "prefade", ontransition: this.open.bind(this)});
		} else this.open(ply);
		return false;
	}
	open(ply){
		if (ply == null) ply = this.open_player;
		this.anim_frame = 0, this.opening = 1;
		ply.last_anim = "back", ply.anim_frame = 0, ply.jump_buffer = maxint;
		if (get_config(this, "type") == 2) play_sound("door2");
		else play_sound("door");
		set_global_freeze({id: "fade", ontransition: this.transition.bind(this)});
	}
	transition(){
		var dest = {x: this.hbox_l+this.hbox.w/2, y: this.hbox_b, area: prefs.area};
		var t = get_config(this, "target");
		var warp = levelsettings.warps.find(w => w.name == t && w.type == 0);
		if (warp != null) dest = {x: warp.x*tilew, y: warp.y*tilew, area: warp.area};
		var players = 0;
		reload_area(dest.area, get_config(this, "revert"), function(ply){
			ply.last_anim = "walk", ply.crouch_state = 0;
			ply.vx = 0, ply.vy = 0, ply.last_vx = 0, ply.last_vy = 0;
			ply.set_fvx(0); ply.set_fvy(0);
			ply.x = dest.x-ply.hbox.x-ply.hbox.w/2, ply.y = dest.y-ply.hbox.y-ply.hbox.h;
			ply.air_tick = maxint;
			if (players > 0) ply.cutscene = {id: "hidden", frame: players*20};
			players++;
		});
		if (warp != null){
			this.opening = 0;
			var ent = ptentities.find(e => e instanceof Door && get_config(e, "name") == t);
			if (ent != null){
				ent.anim_frame = ent.sprite.animations.open.frames+6.25*players-3;
				ent.opening = -1;
				ent.do_drop = ptvars.globaltimer;
			}
		} else {
			this.anim_frame = this.sprite.animations.open.frames+6.25*players-3;
			this.opening = -1;
			this.do_drop = ptvars.globaltimer;
		}
	}
	render(){
		if (this.opening == 0){
			this.draw_sprite();
			this.last_anim = null;
		} else {
			var anim = this.draw_sprite("open");
			this.last_anim = "open";
			if (this.opening > 0){
				this.anim_frame += .25;
				this.anim_frame = Math.min(this.anim_frame, anim.frames);
			} else {
				this.anim_frame -= .25;
				if (this.anim_frame < 0) this.opening = 0;
			}
		}
	}
	powwed(){}
	static editor_shift(ent, action, prev, cur){
		editor_warp_shift(ent, action, prev, cur, 0);
	}
	static bg_layer = 20; // door
}

class Generator extends EntityBase {
	constructor(ent, sprite, hitbox){
		super(ent, sprite, hitbox);
		if (hitbox == null) this.set_hitbox([0, 0, tilew, tilew]);
		this.x -= this.hbox.w/2, this.y -= this.hbox.h/2;
		this.despawn_distance = 3, this.weight = 0;
		this.remove_block_collision = true, this.remove_entity_collision = true;
		this.items = this.conf.items;
		this.spawn_timer = 0, this.spawn_delay = this.conf.delay ?? 60*2;
	}
	update(){
		if (this.items == null || this.items.length < 1){
			if (this.conf.copycontents == null) return;
			var block = get_playtest_tile(this.conf.copycontents[0], this.conf.copycontents[1], 0);
			if (block.id == null || block.contents.length < 1){
				this.kill();
				return;
			}
			this.items = block.contents;
		}
		if (ptvars.globaltimer-this.spawn_timer > this.spawn_delay){
			this.spawn_timer = ptvars.globaltimer;
			var dir = get_config(this, "direction");
			var n = this.items[0];
			this.items.push(this.items.splice(0, 1)[0]); // cycle contents
			var obj = spawn_entity_num(n, this.hbox_l/tilew, this.hbox_t/tilew);
			if (dir%2 == 0){
				obj.release(get_player_entity(), (dir == 2)?-1:1, true);
			} else {
				var x = this.hbox_l+this.hbox.w/2;
				obj.cutscene = {id: "pipe", frame: 29, dir: 4-dir, cutoff: x, nosound: true, release: obj instanceof Collectable};
				obj.y -= (obj.sprite.h-tilew)/2;
				if (dir == 3){
					obj.x = x-obj.hbox.x;
					obj.cutscene.cutoff -= tilew/2;
					obj.facing_left = true;
				} else {
					obj.x = x-obj.hbox.x-obj.hbox.w;
					obj.cutscene.cutoff += tilew/2;
					obj.facing_left = false;
				}
			}
		}
	}
	render(){}
}

// Particles

class ParticleBase {
	constructor(part, sprite){
		this.id = part.id, this.x = part.x, this.y = part.y;
		if (sprite == null) sprite = particledata[this.id];
		this.sprite = {...sprite};
		this.frame = 0; // how many ticks the particle has existed for
		this.lifespan = 10; // particle will die when this.frame == this.lifespan
		this.framespeed = this.sprite.framespeed ?? 1; // how fast the animation plays
		this.vx = 0, this.vy = 0; // constant movement each frame
		this.opacity = this.sprite.opacity ?? 1; // current opacity
		this.fade = false; // whether to fade out a bit each frame
		this.scale = this.sprite.scale ?? 1; // particle scale centered on sprite
		if (this.sprite.frames > 1) this.lifespan = this.sprite.frames*this.framespeed;
	}
	update(){}
	full_update(){
		if (this.frame >= this.lifespan){
			var idx = this.ptindex;
			if (idx != null){
				ptparticles.splice(idx, 1);
				if (globaliter >= idx) globaliter--;
				return;
			}
		}
		this.update();
		this.x += this.vx, this.y += this.vy;
		if (this.opacity < 0) this.opacity = 0;
	}
	draw_sprite(frame, crop, offset){
		if (frame == null) frame = this.frame;
		var anim = this.sprite;
		var sw = anim.w, sh = anim.h;
		var sx = anim.x+sw*(Math.floor(frame*(1/this.framespeed))%this.sprite.frames), sy = anim.y;
		var nw = sw*this.scale, nh = sh*this.scale;
		var nx = this.x+scrollx+sw/2-nw/2, ny = this.y+scrolly+sh/2-nh/2;
		if (crop != null){
			sx += crop[0]*sw, sy += crop[1]*sh, nx += crop[0]*nw, ny += crop[1]*nh;
			sw *= crop[2], sh *= crop[3], nw *= crop[2], nh *= crop[3];
		}
		if (offset != null){
			nx += offset[0], ny += offset[1];
		}
		if (nx > maxw || ny > maxh || nx < -nw || ny < -nh) return;
		ctx.save();
		if (this.fade) ctx.globalAlpha = (1-this.frame/this.lifespan)*this.opacity;
		ctx.drawImage(particlesheet, sx, sy, sw, sh, nx, ny, nw, nh);
		ctx.restore();
		return anim;
	}
	render(){
		this.draw_sprite();
	}
	full_render(){
		this.render();
		this.frame++;
	}
	get ptindex(){
		var idx = ptparticles.indexOf(this);
		if (idx > -1) return idx;
	}
}

class SparkleParticle extends ParticleBase {
	constructor(ent, sprite){
		super(ent, sprite);
		this.lifespan = 10, this.vy = -1, this.fade = true;
		this.sprite.x += this.sprite.w*Math.floor(Math.random()*this.sprite.frames);
		this.sprite.frames = 1;
	}
}

class BoomParticle extends ParticleBase {
	constructor(ent, sprite){
		super(ent, sprite);
		this.fade = true, this.opacity = .8;
	}
	update(){
		if (this.frame == 0) this.scale = 1.5;
		else if (this.frame == 2) this.scale = 1.3;
		else if (this.frame == 4) this.scale = 2.5;
		else if (this.frame == 6) this.scale = 2.3;
		else if (this.frame == 8) this.scale = 3.5;
		else if (this.frame == 10) this.scale = 3.2;
	}
}

class BreakParticle extends ParticleBase {
	constructor(ent, sprite){
		super(ent, sprite);
		this.lifespan = 20, this.scale = .5; // 60 can be an alternate lifespan
		this.bouncevel = -16, this.bounceofs = 10;
	}
	update(){
		this.bouncevel += 1.4;
		this.bounceofs += this.bouncevel;
	}
	render(){
		var xofs = this.frame*.7, yofs = this.bounceofs;
		this.draw_sprite(0, [0, 0, .5, .5], [-xofs*5, yofs*1.2]);
		this.draw_sprite(0, [.5, 0, .5, .5], [xofs*5, yofs*1.2]);
		this.draw_sprite(0, [0, .5, .5, .5], [-xofs, yofs]);
		this.draw_sprite(0, [.5, .5, .5, .5], [xofs, yofs]);
	}
}

// Menus

class EntityMenu {
	static set_color(num){
		if (num == 1) ctx.fillStyle = ctx.strokeStyle = "#444";
		else if (num == 2) ctx.fillStyle = ctx.strokeStyle = "#666";
		else if (num == 0) ctx.fillStyle = ctx.strokeStyle = "#999";
	}
	static set_font(num){
		if (num == 1) ctx.font = "22px Arial", ctx.lineWidth = 3;
		else if (num == 2) ctx.font = "bold 24px Arial", ctx.lineWidth = 3;
		else if (num == 3) ctx.font = "bold 22px Arial", ctx.lineWidth = 1.5;
		else if (num == 4) ctx.font = "bold 22px Arial", ctx.lineWidth = 0;
		else if (num == 5) ctx.font = "italic 20px Arial", ctx.lineWidth = 3;
		else if (num == 6) ctx.font = "bold 26px Arial", ctx.lineWidth = 3;
	}
	static reset_styling(){
		EntityMenu.set_font(1);
		EntityMenu.set_color(1);
	}
	static text(x, y, string, opts={}){
		ctx.textAlign = opts.center?"center":"left";
		if (opts.indent){
			EntityMenu.icon(x-5, y+4, "indent");
			x += 22;
		}
		var ny = y, w = 0;
		var lines = opts.oneline?[string]:string.split("\n");
		for (var ln of lines){
			var m = ctx.measureText(ln);
			if (m.width > w){
				w = m.width;
				if (opts.wrapw != null) w = Math.min(w, opts.wrapw);
			}
			ny += m.fontBoundingBoxAscent;
			if (opts.stroke) ctx.strokeText(ln, x, ny, opts.wrapw);
			else ctx.fillText(ln, x, ny, opts.wrapw);
			ny += 3;
		}
		var ret = {w: w, h: ny-y+8, r: x+w+10, linew: m.width, lineh: m.fontBoundingBoxAscent};
		ret.liney = ny-ret.lineh-1;
		if (opts.wrapw != null) ret.linew = Math.min(ret.linew, opts.wrapw);
		return ret;
	}
	static wrap_text(x, y, wrapw, string){
		var sub = "", total = "";
		for (var i = 0; i < string.length; i++){
			sub += string[i];
			if (string[i] == "\n") total += sub, sub = "";
			else {
				var m = ctx.measureText(sub);
				if (m.width > wrapw){
					total += sub.slice(0, -1)+"\n";
					sub = string[i];
				}
			}
		}
		return EntityMenu.text(x, y, total+sub);
	}
	static polygon(x, y, w, h, ...points){
		var first = true;
		for (p of points){
			if (first){
				ctx.moveTo(x+p[0]*w, y+p[1]*h);
				first = false;
			} else ctx.lineTo(x+p[0]*w, y+p[1]*h);
		}
		ctx.closePath();
	}
	static rect(x, y, w, h){
		ctx.rect(x, y, w, h);
	}
	static circle(x, y, d){
		ctx.arc(x, y, d/2, 0, 2*Math.PI);
	}
	static fill(stroke=false){
		if (!stroke) ctx.fill();
		ctx.stroke();
	}
	static icon(x, y, name, stroke=false, w=20, h=20){
		ctx.beginPath();
		if (!isNaN(name)){
			EntityMenu.set_font(stroke?3:2);
			EntityMenu.text(x+w/2, y+(stroke?-1:-2), name, {center: true, stroke: stroke});
			EntityMenu.set_font(1);
			return;
		}
		switch (name){
			case "arrow_left":
				EntityMenu.polygon(x, y, w, h, [0, .5], [.5, 0], [.5, .3], [1, .3], [1, .7], [.5, .7], [.5, 1]);
				EntityMenu.fill(stroke);
				break;
			case "arrow_right":
				EntityMenu.polygon(x, y, w, h, [1, .5], [.5, 0], [.5, .3], [0, .3], [0, .7], [.5, .7], [.5, 1]);
				EntityMenu.fill(stroke);
				break;
			case "arrow_left_small":
				EntityMenu.polygon(x, y, w, h, [.5, .3], [.5, .9], [.2, .6]);
				EntityMenu.fill(stroke);
				break;
			case "arrow_right_small":
				EntityMenu.polygon(x, y, w, h, [.5, .3], [.5, .9], [.8, .6]);
				EntityMenu.fill(stroke);
				break;
			case "arrow_up":
				EntityMenu.polygon(x, y, w, h, [.5, 0], [1, .5], [.7, .5], [.7, 1], [.3, 1], [.3, .5], [0, .5]);
				EntityMenu.fill(stroke);
				break;
			case "arrow_down":
				EntityMenu.polygon(x, y, w, h, [.5, 1], [1, .5], [.7, .5], [.7, 0], [.3, 0], [.3, .5], [0, .5]);
				EntityMenu.fill(stroke);
				break;
			case "auto":
				EntityMenu.circle(x+w/2, y+h/2, w);
				EntityMenu.fill(stroke);
				if (!stroke) EntityMenu.set_color(0);
				ctx.beginPath();
				EntityMenu.circle(x+w*.32, y+h*.4, w*.25);
				EntityMenu.circle(x+w*.68, y+h*.4, w*.25);
				ctx.fill();
				if (!stroke) EntityMenu.set_color(1);
				break;
			case "yes":
				EntityMenu.polygon(x, y, w, h, [0, .6], [.17, .4], [.33, .57], [.83, 0], [1, .2], [.33, 1]);
				EntityMenu.fill(stroke);
				break;
			case "no":
				EntityMenu.polygon(x, y, w, h, [.2, 0], [.5, .3], [.8, 0], [1, .2], [.7, .5], [1, .8], [.8, 1],
					[.5, .7], [.2, 1], [0, .8], [.3, .5], [0, .2]);
				EntityMenu.fill(stroke);
				break;
			case "player1":
				EntityMenu.rect(x, y+h*.1, w, h*.8);
				EntityMenu.fill(stroke);
				if (!stroke) EntityMenu.set_color(0);
				ctx.beginPath();
				EntityMenu.circle(x+w*.7, y+h*.4, w*.25);
				ctx.fill();
				if (!stroke) EntityMenu.set_color(1);
				break;
			case "player2":
				EntityMenu.circle(x+w/2, y+h/2, w);
				EntityMenu.fill(stroke);
				if (!stroke) EntityMenu.set_color(0);
				ctx.beginPath();
				EntityMenu.rect(x+w*.3, y+h*.3, w*.1, h*.3);
				EntityMenu.rect(x+w*.6, y+h*.3, w*.1, h*.3);
				ctx.fill();
				if (!stroke) EntityMenu.set_color(1);
				break;
			case "star":
				EntityMenu.polygon(x, y+1, w*.9, h*.9, [.5, .03], [.62, .4], [1, .4], [.7, .64], [.8, 1], [.5, .8],
					[.2, 1], [.3, .64], [0, .4], [.38, .4]);
				EntityMenu.fill(stroke);
				break;
			case "stop":
				EntityMenu.polygon(x, y, w, h, [.3, 0], [.7, 0], [1, .3], [1, .7], [.7, 1], [.3, 1], [0, .7], [0, .3]);
				EntityMenu.fill(stroke);
				if (!stroke) EntityMenu.set_color(0);
				ctx.beginPath();
				EntityMenu.rect(x+w*.25, y+h*.4, w*.5, h*.2);
				ctx.fill();
				if (!stroke) EntityMenu.set_color(1);
				break;
			case "dash":
				EntityMenu.rect(x+w*.3, y+h*.45, w*.4, h*.1);
				EntityMenu.fill(stroke);
				break;
			case "popup":
				EntityMenu.polygon(x, y, w, h, [0, .2], [.35, .2], [.35, .4], [.2, .4], [.2, .8], [.6, .8], [.6, .65],
					[.8, .65], [.8, 1], [0, 1]);
				ctx.fill();
				ctx.beginPath();
				EntityMenu.polygon(x, y, w, h, [.4, 0], [1, 0], [1, .6], [.8, .6], [.8, .3], [.45, .65], [.35, .55],
					[.7, .2], [.4, .2]);
				ctx.fill();
				break;
			case "plus":
				EntityMenu.polygon(x, y, w, h, [.35, 0], [.65, 0], [.65, .35], [1, .35], [1, .65], [.65, .65], [.65, 1], [.35, 1],
					[.35, .65], [0, .65], [0, .35], [.35, .35]);
				EntityMenu.fill(stroke);
				break;
			case "cursor":
				EntityMenu.polygon(x, y, w, h, [.2, 0], [1, .8], [.55, .8], [.2, 1]);
				EntityMenu.fill(stroke);
				break;
			case "page":
				EntityMenu.polygon(x, y, w, h, [.4, 0], [.9, 0], [.9, 1], [.1, 1], [.1, .3]);
				EntityMenu.fill(stroke);
				break;
			case "ellipsis":
				EntityMenu.rect(x, y+h*.84, w*.16, h*.16);
				EntityMenu.rect(x+w*.42, y+h*.84, w*.16, h*.16);
				EntityMenu.rect(x+w*.84, y+h*.84, w*.16, h*.16);
				EntityMenu.fill(stroke);
				break;
			case "keyhole":
				EntityMenu.polygon(x, y, w, h, [.5, .25], [.75, 1], [.25, 1]);
				EntityMenu.circle(x+w/2, y+h*.27, h*.55);
				EntityMenu.fill(stroke);
				if (stroke){
					EntityMenu.set_color(0);
					ctx.beginPath();
					EntityMenu.circle(x+w/2, y+h*.27, h*.55-ctx.lineWidth*2);
					EntityMenu.fill();
					EntityMenu.set_color(1);
				}
				break;
			case "timer":
				EntityMenu.circle(x+w/2, y+h/2, h);
				EntityMenu.fill(stroke);
				ctx.save();
				ctx.beginPath();
				ctx.lineCap = "round";
				ctx.moveTo(x+w/2, y+h*.25);
				ctx.lineTo(x+w/2, y+h/2);
				ctx.lineTo(x+w*.25, y+h/2);
				if (!stroke) EntityMenu.set_color(0);
				ctx.stroke();
				ctx.restore();
				break;
			case "indent":
				ctx.moveTo(x+w/2, y);
				ctx.lineTo(x+w/2, y+h/2);
				ctx.lineTo(x+w, y+h/2);
				ctx.stroke();
				break;
		}
	}
	static icon_hover(x, y, side=0){
		if (mousex >= x-5 && mousex <= x+25 && mousey >= y-2 && mousey <= y+22){
			if (side == -1 && mousex > x+16) return false;
			if (side == 1 && mousex < x+3) return false;
			EntityMenu.set_color(2);
			return true;
		}
		return false;
	}
	static toggle_icon(x, y, ent, category){
		var hover = EntityMenu.icon_hover(x, y);
		var val = get_config(ent, category);
		EntityMenu.icon(x, y, val?"yes":"no", true);
		if (hover){
			EntityMenu.set_color(1);
			if (lmdown == 1){
				set_config(ent, category, !val);
				menu.reqrelease = true;
			}
		}
	}
	static radio_icon(x, y, name, ent, category, val){
		var hover = EntityMenu.icon_hover(x, y);
		EntityMenu.icon(x, y, name, get_config(ent, category) == val);
		if (hover){
			EntityMenu.set_color(1);
			if (lmdown == 1){
				set_config(ent, category, val);
				menu.reqrelease = true;
			}
		}
	}
	static contents_icon(x, y, ent, category="contents", validation=null, nochange=false, setpage=false){
		var hover = EntityMenu.icon_hover(x, y);
		var contents = get_config(ent, category);
		if (contents != null){
			if (hover){
				ctx.beginPath();
				EntityMenu.rect(x-3, y-3, 26, 26);
				EntityMenu.fill(false);
			}
			var d = get_sprite_data(contents, true);
			var s = blocksheet;
			if (contents.type == 1) s = entitysheet;
			ctx.drawImage(s, d.x, d.y, d.w, d.h, x-3, y-3, 26, 26);
		} else EntityMenu.icon(x, y, "plus", true);
		if (hover){
			EntityMenu.set_color(1);
			if (lmdown == 1 && !nochange){
				var n = {num: menu.page, category: category, validation: validation, contentsdir: null};
				if (menu.contentsdir != null) n.contentsdir = [...menu.contentsdir];
				if (setpage) n.menuid = menu.id, n.num = ent;
				set_menu("tiles", 0);
				menu.returnto = {...n};
			} else if (rmdown == 1 && contents.type == 1){
				menu.subpage = "contents";
				if (menu.contentsdir == null) menu.contentsdir = [];
				menu.contentsdir.push(category);
			} else if (mmdown == 1){
				if (contents.type == 0){
					curtile = {id: contents.id, type: 0};
				} else if (contents.type == 1){
					curtile = {id: contents.id, type: 1, conf: {...contents.conf}};
				}
				check_curtile_in_hotbar();
			}
		}
		if (get_config(ent, category) != null){
			if (!nochange){
				x += 30;
				hover = EntityMenu.icon_hover(x, y);
				EntityMenu.icon(x, y, "no", true);
				if (hover){
					EntityMenu.set_color(1);
					if (lmdown == 1){
						set_config(ent, category, null);
						menu.reqrelease = true;
						if (validation != null) validation(ent);
					}
				}
			}
			if (contents != null && contents.type == 1){
				x += 30;
				hover = EntityMenu.icon_hover(x, y);
				EntityMenu.icon(x, y, "popup", false);
				if (hover){
					EntityMenu.set_color(1);
					if (lmdown == 1){
						menu.subpage = "contents";
						if (menu.contentsdir == null) menu.contentsdir = [];
						menu.contentsdir.push(category);
						menu.reqrelease = true;
					}
				}
			}
		}
	}
	static option_menu(x, y, opts, ent, category, widgetopts){
		var cur = get_config(ent, category);
		if (category == "font") ctx.font = "bold 22px "+indexedfonts[cur];
		else EntityMenu.set_font(4);
		var w = ctx.measureText(opts[cur]).width;
		var hover2 = EntityMenu.icon_hover(x+w+16, y, 1);
		if (hover2) EntityMenu.set_color(1);
		var hover = EntityMenu.icon_hover(x, y, -1);
		EntityMenu.icon(x, y, "arrow_left_small", true);
		if (hover){
			EntityMenu.set_color(1);
			if (lmdown == 1){
				set_config(ent, category, (cur-1+opts.length)%opts.length);
				menu.reqrelease = true;
			}
		}
		if (!hover && !hover2 && widgetopts != null && mousex >= x+18 && mousex <= x+w+16 && mousey >= y && mousey <= y+22){
			hover = true;
			EntityMenu.set_color(2);
		} else hover = false;
		var m = EntityMenu.text(x+18, y, opts[cur]);
		x = m.r-12;
		EntityMenu.set_font(1);
		if (hover){
			EntityMenu.set_color(1);
			if (lmdown == 1){
				menu.subpage = "widget";
				if (widgetopts.setpage != null) menu.page = widgetopts.setpage;
				menu.widget = {type: "select", field: category, scroll: 0, prev: cur, options: opts, hidenone: true,
					useindex: true, ...widgetopts};
			}
		}
		if (hover2) EntityMenu.set_color(2);
		EntityMenu.icon(x, y, "arrow_right_small", true);
		if (hover2){
			EntityMenu.set_color(1);
			if (lmdown == 1){
				set_config(ent, category, (cur+1)%opts.length);
				menu.reqrelease = true;
			}
		}
	}
	static counter(x, y, min, max, ent, category, incr=1, allowinf=false){
		if (allowinf) min -= incr;
		var cur = get_config(ent, category);
		if (min == null || cur > min){
			var hover = EntityMenu.icon_hover(x, y, -1);
			EntityMenu.icon(x, y, "arrow_left_small", true);
			if (hover){
				EntityMenu.set_color(1);
				if (lmdown == 1){
					set_config(ent, category, (min == null)?(cur-incr):Math.max(cur-incr, min));
					menu.reqrelease = true;
				}
			}
		}
		if (allowinf && cur == min){
			EntityMenu.set_font(6);
			var m = EntityMenu.text(x+14, y-3, "\u221e");
			x = m.r-14;
		} else {
			EntityMenu.set_font(4);
			var m = EntityMenu.text(x+18, y, cur.toString());
			x = m.r-12;
		}
		EntityMenu.set_font(1);
		if (max == null || cur < max){
			var hover = EntityMenu.icon_hover(x, y, 1);
			EntityMenu.icon(x, y, "arrow_right_small", true);
			if (hover){
				EntityMenu.set_color(1);
				if (lmdown == 1){
					set_config(ent, category, (max == null)?(cur+incr):Math.min(cur+incr, max));
					menu.reqrelease = true;
				}
			}
		}
	}
	static slider(x, y, min, max, ent, category, w=100){
		var cur = (get_config(ent, category)-min)/max;
		var hover = mousex >= x-10 && mousex <= x+w+10 && mousey >= y && mousey <= y+25;
		y += 13;
		ctx.save();
		ctx.lineWidth = 4, ctx.lineCap = "round";
		EntityMenu.set_color(2);
		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.lineTo(x+w, y);
		ctx.stroke();
		EntityMenu.set_color(1);
		if (hover) ctx.lineWidth++;
		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.lineTo(x+cur*w, y);
		ctx.stroke();
		EntityMenu.circle(x+cur*w, y, 5+hover);
		EntityMenu.fill();
		ctx.restore();
		if (hover && lmdown > 0){
			set_config(ent, category, Math.round(Math.min(Math.max((mousex-x)/w, 0), 1)*(max-min)+min));
		}
	}
	static button(x, y, w, text, func){
		var hover = mousex >= x && mousex <= x+w && mousey >= y && mousey <= y+33;
		rounded_rect(x, y, w, 33, 5);
		if (hover){
			ctx.fillStyle = "#aaa";
			ctx.fill();
			EntityMenu.set_color(1);
		}
		ctx.stroke();
		EntityMenu.text(x+w/2, y+4, text, {center: true});
		if (hover && lmdown == 1 && func != null) func();
	}
	static text_widget(x, y, ent, category, wrapw, widgetopts, text){
		x -= 3, y += 2;
		var hover = false;
		if (text == null){
			text = get_config(ent, category);
			if (text != null) text = text.toString();
		}
		if (text != null && text != ""){
			EntityMenu.set_font(5);
			if (mousex >= x-5 && mousex <= x+wrapw+5 && mousey >= y-2 && mousey <= y+22){
				EntityMenu.set_color(2);
				hover = true;
			}
			if (ctx.measureText(text).width > wrapw){
				text = text.slice(0, 30);
				while (ctx.measureText(text+"...").width > wrapw){
					text = text.slice(0, -1);
				}
				EntityMenu.text(x, y, text+"...", {oneline: true});
			} else EntityMenu.text(x, y, text, {oneline: true});
			EntityMenu.set_font(1);
		} else {
			hover = EntityMenu.icon_hover(x, y);
			EntityMenu.icon(x, y, "dash", false);
		}
		if (hover){
			EntityMenu.set_color(1);
			if (lmdown == 1){
				if (shift_pressed()){
					if (!widgetopts.typeok) return;
					if (text == null) set_config(ent, category, "");
					menu.subpage = "widget";
					if (widgetopts.setpage != null) menu.page = widgetopts.setpage;
					widgetopts.type = "text", widgetopts.linelimit = 1;
					menu.widget = {field: category, scroll: 0, prev: get_config(ent, category), ...widgetopts};
				} else {
					if (text == null) set_config(ent, category, "");
					menu.subpage = "widget";
					if (widgetopts.setpage != null) menu.page = widgetopts.setpage;
					menu.widget = {type: "text", field: category, scroll: 0, prev: get_config(ent, category), ...widgetopts};
				}
			}
		}
	}
}

class MenuPresets {
	static blank(ent, x, y, w, h){
		y += EntityMenu.text(x+w/2, y, "There are no options to\nconfigure for this entity.", {center: true}).h;
		y += EntityMenu.text(x+w/2, y+10, "Click the i in the top-right\ncorner to view keyboard\nshortcuts.", {center: true}).h;
		return y;
	}
	static info(ent, x, y, w, h){
		y += EntityMenu.text(x+w/2, y-5, "Shortcuts:\nArrow keys - Nudge\nDelete - Delete\nEscape - Close menu"+
			"\nD - Duplicate\n[ ] - Change layer", {center: true}).h;
		return y;
	}
	static global(ent, x, y, w, h){
		if (block_containing_entity(ent, true)){
			var m = EntityMenu.text(x, y, "In block");
			EntityMenu.toggle_icon(m.r, y, ent, "inblock");
			y += m.h;
		}
		return y;
	}
	static global_blank(ent, x, y, w, h){
		var ny = MenuPresets.global(ent, x, y, w, h);
		if (y != ny) return true;
		MenuPresets.blank(ent, x, y, w, h);
		return false;
	}
	static flip(ent, x, y, w, h, direction=true, frozen=true){
		var m = EntityMenu.text(x, y, "Direction");
		if (direction){
			EntityMenu.radio_icon(m.r, y, "auto", ent, "direction", 2);
			EntityMenu.radio_icon(m.r+30, y, "arrow_left", ent, "direction", 0);
			EntityMenu.radio_icon(m.r+60, y, "arrow_right", ent, "direction", 1);
			if (frozen) EntityMenu.radio_icon(m.r+90, y, "stop", ent, "direction", 3);
		} else {
			EntityMenu.radio_icon(m.r, y, "arrow_down", ent, "direction", 2);
			if (frozen) EntityMenu.radio_icon(m.r+30, y, "stop", ent, "direction", 3);
		}
		y += m.h;
		y = MenuPresets.global(ent, x, y, w, h);
		return y;
	}
	static contents(ent, x, y, w, h){
		var m = EntityMenu.text(x, y, "Contents");
		EntityMenu.contents_icon(m.r, y, ent);
		y += m.h;
		return y;
	}
	static flip_contents(ent, x, y, w, h, ...args){
		y = MenuPresets.flip(ent, x, y, w, h, ...args);
		y = MenuPresets.contents(ent, x, y, w, h);
		return y;
	}
	static nogravity(ent, x, y, w, h){
		y = MenuPresets.flip(ent, x, y, w, h, false);
		return y;
	}
	static nogravity_contents(ent, x, y, w, h){
		y = MenuPresets.flip_contents(ent, x, y, w, h, false);
		return y;
	}
	static walking_enemy(ent, x, y, w, h){
		y = MenuPresets.flip_contents(ent, x, y, w, h);
		var m = EntityMenu.text(x, y, "Turn at edges");
		EntityMenu.toggle_icon(m.r, y, ent, "smart");
		y += m.h;
		return y;
	}
	static jumping_enemy(ent, x, y, w, h){
		y = MenuPresets.flip_contents(ent, x, y, w, h);
		var m = EntityMenu.text(x, y, "Mad");
		EntityMenu.toggle_icon(m.r, y, ent, "fast");
		y += m.h;
		return y;
	}
	static multi_direction(ent, x, y, w, h){
		var m = EntityMenu.text(x, y, "Direction");
		EntityMenu.radio_icon(m.r, y, "arrow_down", ent, "direction", 2);
		EntityMenu.radio_icon(m.r+30, y, "arrow_up", ent, "direction", 0);
		EntityMenu.radio_icon(m.r+60, y, "arrow_left", ent, "direction", 3);
		EntityMenu.radio_icon(m.r+90, y, "arrow_right", ent, "direction", 1);
		y += m.h;
		return y;
	}
	static powerup(ent, x, y, w, h){
		y = MenuPresets.flip(ent, x, y, w, h, get_config(ent, "speed") != 0);
		if (get_config(ent, "type") > 1){
			var m = EntityMenu.text(x, y, "Progressive");
			EntityMenu.toggle_icon(m.r, y, ent, "progressive");
			y += m.h;
			m = EntityMenu.text(x, y, "Revert to mushroom");
			EntityMenu.toggle_icon(m.r, y, ent, "revert");
			y += m.h;
		} else if (get_config(ent, "type") == 1){
			var m = EntityMenu.text(x, y, "Force state");
			EntityMenu.toggle_icon(m.r, y, ent, "revert");
			y += m.h;
		}
	}
	static collectable(ent, x, y, w, h){
		var m = EntityMenu.text(x, y, "Contents");
		EntityMenu.contents_icon(m.r, y, ent);
		y += m.h;
		y = MenuPresets.global(ent, x, y, w, h);
		return y;
	}
	static large_coin(ent, x, y, w, h){
		var m = EntityMenu.text(x, y, "Type");
		EntityMenu.radio_icon(m.r, y, "10", ent, "type", 0);
		EntityMenu.radio_icon(m.r+30, y, "30", ent, "type", 1);
		EntityMenu.radio_icon(m.r+60, y, "50", ent, "type", 2);
		EntityMenu.radio_icon(m.r+90, y, "star", ent, "type", -1);
		y += m.h;
		y = MenuPresets.collectable(ent, x, y, w, h);
	}
	static key(ent, x, y, w, h){
		y = MenuPresets.collectable(ent, x, y, w, h);
		var m = EntityMenu.text(x, y, "Cursed");
		EntityMenu.toggle_icon(m.r, y, ent, "bad");
		y += m.h;
	}
	static key_coin(ent, x, y, w, h){
		var m = EntityMenu.text(x, y, "Group");
		EntityMenu.radio_icon(m.r, y, "1", ent, "group", 1);
		EntityMenu.radio_icon(m.r+30, y, "2", ent, "group", 2);
		EntityMenu.radio_icon(m.r+60, y, "3", ent, "group", 3);
		EntityMenu.radio_icon(m.r+90, y, "4", ent, "group", 4);
		y += m.h;
		y = MenuPresets.collectable(ent, x, y, w, h);
	}
	static block_properties(ent, x, y, w, h){
		var m = EntityMenu.text(x, y, "Surface");
		EntityMenu.option_menu(m.r, y, ["Solid", "Slippery", "Sticky"], ent, "surface", {name: "Surface"});
		y += m.h;
		m = EntityMenu.text(x, y, "Semisolid");
		EntityMenu.option_menu(m.r, y, ["No", "Top", "Bottom", "Left", "Right"], ent, "semisolid", {name: "Semisolid"});
		y += m.h;
		m = EntityMenu.text(x, y, "Hurts");
		EntityMenu.option_menu(m.r, y, ["No", "Yes", "Instant kill", "Yes except bottom", "Yes except top",
			"Yes except right", "Yes except left"], ent, "hurts", {name: "Hurts"});
		y += m.h;
		m = EntityMenu.text(x, y, "Destroyable");
		EntityMenu.option_menu(m.r, y, ["No", "From bump", "From bomb"], ent, "destroyable", {name: "Destroyable"});
		y += m.h;
		m = EntityMenu.text(x, y, "Player pass-through");
		EntityMenu.toggle_icon(m.r, y, ent, "playerpass");
		y += m.h;
		m = EntityMenu.text(x, y, "Entity pass-through");
		EntityMenu.toggle_icon(m.r, y, ent, "entitypass");
		y += m.h;
		m = EntityMenu.text(x, y, "Invisible");
		EntityMenu.toggle_icon(m.r, y, ent, "hidden");
		y += m.h;
		m = EntityMenu.text(x, y, "Contents");
		EntityMenu.contents_icon(m.r, y, ent);
		y += m.h;
		if (ent.conf.contents != null){
			m = EntityMenu.text(x, y, "Infinite contents", {indent: 1});
			EntityMenu.toggle_icon(m.r, y, ent, "infcontents");
			y += m.h;
		}
		y = MenuPresets.global(ent, x, y, w, h);
	}
	static blockentity_grabbable(ent, x, y, w, h, direction=true){
		if (direction) y = MenuPresets.nogravity(ent, x, y, w, h);
		else y = MenuPresets.global(ent, x, y, w, h);
		m = EntityMenu.text(x, y, "Grabbable");
		EntityMenu.toggle_icon(m.r, y, ent, "grabbable");
		y += m.h;
		return y;
	}
	static blockentity_activatable(ent, x, y, w, h){
		y = MenuPresets.blockentity_grabbable(ent, x, y, w, h);
		m = EntityMenu.text(x, y, "Contents");
		EntityMenu.contents_icon(m.r, y, ent);
		y += m.h;
		m = EntityMenu.text(x, y, "Activate immediately");
		EntityMenu.toggle_icon(m.r, y, ent, "instant");
		y += m.h;
		return y;
	}
	static stone(ent, x, y, w, h){
		y = MenuPresets.blockentity_grabbable(ent, x, y, w, h);
		var vert = get_config(ent, "size") > 1;
		var m = EntityMenu.text(x, y, "Length");
		EntityMenu.radio_icon(m.r, y, "1", ent, "size", 1);
		EntityMenu.radio_icon(m.r+30, y, "2", ent, "size", 2);
		EntityMenu.radio_icon(m.r+60, y, "3", ent, "size", 3);
		y += m.h;
		if (vert){
			m = EntityMenu.text(x, y, "Vertical", {indent: 1});
			EntityMenu.toggle_icon(m.r, y, ent, "vertical");
			y += m.h;
		}
	}
	static boom_block(ent, x, y, w, h){
		y = MenuPresets.blockentity_activatable(ent, x, y, w, h);
		m = EntityMenu.text(x, y, "Behavior");
		EntityMenu.option_menu(m.r, y, ["Kill grounded enemies", "Kill all enemies", "Destroy blocks"], ent, "type", {name: "Behavior"});
		y += m.h;
	}
	static spring(ent, x, y, w, h){
		y = MenuPresets.blockentity_grabbable(ent, x, y, w, h);
		m = EntityMenu.text(x, y, "Vertical");
		EntityMenu.toggle_icon(m.r, y, ent, "vertical");
		y += m.h;
		m = EntityMenu.text(x, y, "Powerful");
		EntityMenu.toggle_icon(m.r, y, ent, "high");
		y += m.h;
	}
	static crusher(ent, x, y, w, h){
		y = MenuPresets.multi_direction(ent, x, y, w, h);
		var m = EntityMenu.text(x, y, "Contents");
		EntityMenu.contents_icon(m.r, y, ent);
		y += m.h;
		m = EntityMenu.text(x, y, "Spikeless");
		EntityMenu.toggle_icon(m.r, y, ent, "spikeless");
		y += m.h;
		m = EntityMenu.text(x, y, "Mad");
		EntityMenu.toggle_icon(m.r, y, ent, "fast");
		y += m.h;
		y = MenuPresets.global(ent, x, y, w, h);
	}
	static shell(ent, x, y, w, h){
		var m = EntityMenu.text(x, y, "Contents");
		EntityMenu.contents_icon(m.r, y, ent);
		y += m.h;
		m = EntityMenu.text(x, y, "Grabbable");
		EntityMenu.toggle_icon(m.r, y, ent, "grabbable");
		y += m.h;
		m = EntityMenu.text(x, y, "Wearable");
		EntityMenu.toggle_icon(m.r, y, ent, "wearable");
		y += m.h;
		y = MenuPresets.global(ent, x, y, w, h);
	}
	static background_npc(ent, x, y, w, h){
		var m = EntityMenu.text(x, y, "Message");
		var font = indexedfonts[get_config(ent, "font")];
		EntityMenu.text_widget(m.r, y, ent, "message", w-m.w, {name: "Message", linelimit: 10, font: font});
		y += m.h;
		m = EntityMenu.text(x, y, "Font");
		EntityMenu.option_menu(m.r, y, ["Default", "Monospace", "Serif"], ent, "font", {name: "Font"});
		y += m.h;
		m = EntityMenu.text(x, y, "Colors");
		EntityMenu.option_menu(m.r, y, ["Standard", "Paper", "Oak", "Matrix", "Party"], ent, "colorset", {name: "Colors"});
		y += m.h;
		m = EntityMenu.text(x, y, "Gift");
		EntityMenu.contents_icon(m.r, y, ent);
		y += m.h;
		m = EntityMenu.text(x, y, "Message in background");
		EntityMenu.toggle_icon(m.r, y, ent, "background");
		y += m.h;
		y = MenuPresets.global(ent, x, y, w, h);
		return y;
	}
	static warp(ent, x, y, w, h, name="Warp", type=0){
		var oy = y, m = EntityMenu.text(x, y, name+" name");
		EntityMenu.text_widget(m.r, y, ent, "name", w-m.w, {name: name+" name", linelimit: 1, shift: true});
		y += m.h;
		m = EntityMenu.text(x, y, "Warp to");
		EntityMenu.text_widget(m.r, y, ent, "target", w-m.w, {type: "select", name: "Warp to",
			optionsfunc: get_warp_names, linelimit: 10, typeok: true, warptype: type});
		y += m.h;
		var target = get_config(ent, "target");
		if (target == "") target = null;
		if (target != null){
			m = EntityMenu.text(x, y, "Reload area", {indent: 1});
			EntityMenu.toggle_icon(m.r, y, ent, "revert");
			y += m.h;
		}
		m = EntityMenu.text(x, y, "Exit gift");
		EntityMenu.contents_icon(m.r, y, ent);
		y += m.h;
		if (target != null && target != get_config(ent, "name")){
			EntityMenu.button(x, oy+h-42, w/2, "Go to exit", function(){go_to_warp(target, type)});
		}
		return y;
	}
	static pipe_warp(ent, x, y, w, h){
		y = MenuPresets.warp(ent, x, y, w, h, "Pipe", 1);
		var prev = get_config(ent, "direction");
		y = MenuPresets.multi_direction(ent, x, y, w, h);
		if (prev != get_config(ent, "direction")) shift_editor_entity(ent, "other");
		prev = get_config(ent, "size");
		var m = EntityMenu.text(x, y, "Size");
		EntityMenu.option_menu(m.r, y, ["Small", "Normal"], ent, "size", {name: "Size"});
		y += m.h;
		if (prev != get_config(ent, "size")) shift_editor_entity(ent, "other");
		y = MenuPresets.global(ent, x, y, w, h);
	}
	static door_warp(ent, x, y, w, h){
		y = MenuPresets.warp(ent, x, y, w, h, "Door", 0);
		var m = EntityMenu.text(x, y, "Type");
		EntityMenu.option_menu(m.r, y, ["Double doors", "Right hinge", "Shutter"], ent, "type", {name: "Type"});
		y += m.h;
		m = EntityMenu.text(x, y, "Modifiers");
		EntityMenu.radio_icon(m.r, y, "no", ent, "modifier", 0);
		EntityMenu.radio_icon(m.r+30, y, "keyhole", ent, "modifier", 1);
		EntityMenu.radio_icon(m.r+60, y, "timer", ent, "modifier", 2);
		y += m.h;
		y = MenuPresets.global(ent, x, y, w, h);
	}
	static player(ent, x, y, w, h){
		var m = EntityMenu.text(x, y, "Powerup");
		EntityMenu.option_menu(m.r, y, ["None", "Mushroom", "Fire Flower"], ent, "state", {name: "Powerup"});
		y += m.h;
		m = EntityMenu.text(x, y, "Invincibility star");
		EntityMenu.toggle_icon(m.r, y, ent, "invinstar");
		y += m.h;
		y = MenuPresets.global(ent, x, y, w, h);
	}
	static level_settings(ent, x, y, w, h){
		var oy = y, m = EntityMenu.text(x, y, "Level name");
		EntityMenu.text_widget(m.r, y, levelsettings, "displayname", w-m.w, {name: "Level name", linelimit: 1,
			setpage: levelsettings});
		y += m.h;
		m = EntityMenu.text(x, y, "Starting character");
		EntityMenu.contents_icon(m.r, y, levelsettings, "playerent", null, true, true);
		y += m.h;
		m = EntityMenu.text(x, y, "Player lives");
		EntityMenu.counter(m.r, y, 1, null, levelsettings, "playerlives", 1, true);
		y += m.h;
		m = EntityMenu.text(x, y, "Level timer");
		EntityMenu.counter(m.r, y, 10, null, levelsettings, "timer", 10, true);
		y += m.h;
		m = EntityMenu.text(x, y, "Join ground and metal");
		EntityMenu.toggle_icon(m.r, y, levelsettings, "dynamicjoin");
		y += m.h+10;
		m = EntityMenu.text(x, y, "Current subarea");
		EntityMenu.text_widget(m.r, y, prefs, "area", w-m.w, {type: "select", name: "Current subarea",
			optionsfunc: get_subarea_names, linelimit: 11, hidenone: true, useindex: true, setpage: prefs,
			shift: true}, areasettings.areaname);
		y += m.h;
		m = EntityMenu.text(x, y, "Area name");
		EntityMenu.text_widget(m.r, y, areasettings, "areaname", w-m.w, {name: "Area name", linelimit: 1,
			setpage: areasettings, shift: true});
		y += m.h;
		var prev = areasettings.areah;
		m = EntityMenu.text(x, y, "Area height");
		EntityMenu.counter(m.r, y, 14, null, areasettings, "areah");
		y += m.h;
		m = EntityMenu.text(x, y, "Area theme");
		EntityMenu.option_menu(m.r, y, ["Overworld", "Underground"], areasettings, "theme", {name: "Theme", setpage: areasettings});
		y += m.h;
		var diff = areasettings.areah-prev;
		if (diff > 0){
			blocks = blocks.map(col => Array(diff).fill(null).concat(col));
			for (ent of entities){
				ent.y = Math.max(Math.min(ent.y+diff, areasettings.areah-.5), -.5);
			}
			scrolly -= tilew*diff;
		} else if (diff < 0){
			blocks = blocks.map(col => col.slice(-diff));
			for (ent of entities){
				ent.y = Math.max(Math.min(ent.y+diff, areasettings.areah-.5), -.5);
			}
			clamp_scroll();
		}
		EntityMenu.button(x-5, oy+h-42, w/2, "New subarea", click_new_subarea_button);
		EntityMenu.button(x+w/2+5, oy+h-42, w/2, "Delete subarea", click_delete_subarea_button);
	}
	static preferences(ent, x, y, w, h){
		var oy = y, m = EntityMenu.text(x, y, "Character");
		EntityMenu.radio_icon(m.r, y, "player1", prefs, "character", 0);
		EntityMenu.radio_icon(m.r+30, y, "player2", prefs, "character", 1);
		y += m.h;
		m = EntityMenu.text(x, y, "Music volume");
		EntityMenu.slider(m.r, y, 0, 100, prefs, "musicvolume");
		y += m.h;
		m = EntityMenu.text(x, y, "SFX volume");
		EntityMenu.slider(m.r, y, 0, 100, prefs, "sfxvolume");
		y += m.h;
		m = EntityMenu.text(x, y, "FPS Limit");
		EntityMenu.counter(m.r, y, 48, 72, prefs, "fpslimit", 12);
		y += m.h;
		m = EntityMenu.text(x, y, "Press up to jump");
		EntityMenu.toggle_icon(m.r, y, prefs, "tapjump");
		y += m.h;
		m = EntityMenu.text(x, y, "Prevent duplicate entity layering");
		EntityMenu.toggle_icon(m.r, y, prefs, "prevententitystack");
		y += m.h;
		m = EntityMenu.text(x, y, "Show hitboxes");
		EntityMenu.toggle_icon(m.r, y, prefs, "showhitboxes");
		y += m.h;
		EntityMenu.button(x-5, oy+h-42, w*.6, "Reset preferences", click_reset_preferences_button);
	}
}

class MenuWidgets {
	static text(ent, x, y, w, h){
		ctx.font = "22px "+(menu.widget.font || "Arial");
		var m = EntityMenu.text(x, y, get_config(ent, menu.widget.field), {wrapw: w});
		if (Math.floor(frame/24)%3 > 0){
			ctx.beginPath();
			ctx.moveTo(x+m.linew+3, m.liney);
			ctx.lineTo(x+m.linew+3, m.liney+m.lineh);
			ctx.stroke();
		}
	}
	static select(ent, x, y, w, h){
		if (menu.widget.optionsfunc != null){
			menu.widget.options = menu.widget.optionsfunc(ent);
			menu.widget.optionsfunc = null;
		}
		var opts = [...menu.widget.options];
		if (!menu.widget.hidenone) opts.unshift(null);
		var cur = get_config(ent, menu.widget.field);
		if (cur == "" && !menu.widget.useindex) cur = null;
		var ny = y, set = null;
		var max = opts.length;
		if (menu.widget.linelimit != null && menu.widget.linelimit < max) max = menu.widget.linelimit;
		menu.widget.scroll = Math.min(Math.max(menu.widget.scroll, 0), opts.length-max);
		ctx.textAlign = "left";
		for (i = menu.widget.scroll; i < max+menu.widget.scroll; i++){
			var hover = false;
			var m = ctx.measureText(opts[i]);
			if (mousex >= x-5 && mousex <= x+w+5 && mousey >= ny && mousey <= ny+m.fontBoundingBoxAscent+4){
				EntityMenu.set_color(2);
				hover = true;
			}
			if (cur == (menu.widget.useindex?i:opts[i])){
				EntityMenu.set_color(hover?2:1);
				ctx.fillRect(x-2, ny-1, w+4, m.fontBoundingBoxAscent+5);
				EntityMenu.set_color(0);
			}
			ny += m.fontBoundingBoxAscent;
			ctx.fillText((opts[i] == null)?"None":opts[i], x, ny, w);
			ny += 4;
			EntityMenu.set_color(1);
			if (hover && lmdown == 1) set = i;
		}
		EntityMenu.set_color(2);
		if (menu.widget.scroll > 0) ctx.fillRect(x+w+7, y+h-32, 2, 10);
		if (menu.widget.scroll < opts.length-max) ctx.fillRect(x+w+7, y+h-20, 2, 10);
		if (set != null){
			if (menu.widget.shift) menu.widget.cur = menu.widget.useindex?set:opts[set];
			else set_config(ent, menu.widget.field, menu.widget.useindex?set:opts[set]);
			close_menu_widget();
		}
	}
}

