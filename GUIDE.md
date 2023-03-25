# User guide

# Editor Layout

![editor layout](https://user-images.githubusercontent.com/95201497/227702555-7e44ee04-f1f6-476a-9ca8-33a4536eb2cc.png)

This is the layout of the editor. Blocks and tools are located in the top toolbar, and extras such as settings and preferences are located in the bottom toolbar.

### Label Overview

**Eraser** - Erase tiles instead of placing them.

**Multiselect** - Click and drag to select groups of blocks.

**Fill bucket** - Quickly fill large areas with the current tile.

**Tile hotbar** - The 12 most recently placed tiles will appear here.

**Tile menu** - Contains the full tile selection.

**Collapse toolbar** - Click the thin line towards the edge of either toolbar to hide it.

**Playtest level** - Enter level testing mode, where you can interact with blocks and entities.

**Save/load** - Access various options for saving and loading levels.

**Paste** - Paste tiles from your clipboard after copying them from multiselect.

**Preferences** - Access your personal preferences in order to improve the user experience.

**Settings** - Access settings for the level and make or delete subareas.

# Controls

## Editing

### General

**Left click/drag** - Place currently selected tile.

**Right click** - Edit configuration options for the hovered tile. (Entities only)

**Middle click** - Set the currently selected tile to the hovered tile.

**Middle button drag** - Pan the editor view. Shift: Pan faster.

**Scroll wheel** - Pan the editor view horizontally. Shift: Pan faster. Ctrl: Pan vertically.

**Arrow keys** - Pan the editor view. Shift: Pan faster.

**W** - Select the previous tile in the hotbar.

**S** - Select the next tile in the hotbar.

**A** - Change to the previous tile variant.

**D** - Change to the next tile variant.

**E** - Toggle eraser tool.

**Q** - Toggle multiselect tool.

**B** - Toggle fill bucket tool.

**T** - Open the tile selection menu.

**P** - Enter level playtesting mode.

**Tab** - Cycle the visibility state of the toolbars.

**Home** - Scroll to the leftmost side of the level.

**End** - Scroll to the rightmost side of the level.

**Page up** - Scroll to the topmost side of the level.

**Page down** - Scroll to the bottommost side of the level.

**Ctrl+S** - Save the current level to the clipboard.

**Ctrl+O** - Load a level from the clipboard’s contents.

**Ctrl+V** - Paste multiselect data from the clipboard.

### Entity menu

**Escape/enter** - Exit the menu.

**Delete/backspace** - Delete the entity.

**Arrow keys** - Move the entity in the specified direction. Shift: Increase distance.

**D** - Duplicate the entity and move it down and right by half a block. Shift: Don’t move the duplicated entity.

**\[** - Move the entity back by one layer. Shift/ctrl: Move to the lowest layer.

**]** - Move the entity forward by one layer. Shift/ctrl: Move to the highest layer.

**Shift** - Hold to make the menu partially transparent.

### Multiselect

**Escape/enter** - Deselect all selected tiles.

**Delete/backspace** - Delete the selected tiles.

**WASD** - Move the selected tiles in the specified direction. Shift: Increase distance.

**Ctrl+C** - Copy the currently selected tiles to the clipboard. Shift: Don’t copy to clipboard, instead immediately transfer the contents into paste mode.

**Ctrl+X** - Copy the currently selected tiles to the clipboard and then delete them from the level. Shift: Don’t copy to clipboard, instead immediately transfer the contents into paste mode.

### Paste mode

**Escape/enter** - Exit paste mode.

**WASD** - Change the cursor offset of the pasted blocks. Shift: Increase offset amount.

## Tile menu

**Left click** - Select the hovered tile. If the tile darkens when hovered, it cannot be selected in this particular scenario - for example, you cannot put doors inside of other entities.

**Right click** - Open the variant menu for the hovered tile, if present.

**T/escape** - Exit the menu.

## Playtesting

**Left/right arrow keys, AD** - Move the player left or right.

**Up arrow key, W** - Interact with a door or sign behind the player. If the player is touching neither of those objects and is on the ground, it will jump.

**K/X/space** - Make the player jump if on the ground.

**Down arrow key, S** - Make the player crouch if on the ground.

**L/Z/shift** - Hold to make the player run, and shoot a fireball if the player has a fire flower powerup.

**P** - Exit playtest mode.

# Making A Level

## Modifying Entities

By right-clicking on an entity, it will open its configuration menu. Each entity has a unique menu for all of the different settings you can modify. An example menu is shown below.

![entity menu](https://user-images.githubusercontent.com/95201497/227702824-fc1c4137-4aad-4052-ad3e-5d687ba04627.png)

The most common options for entities are its direction and contents.

### List of (most) configuration fields

**Direction** - The first option (auto) will make the entity face towards the player when it first spawns. The arrows can be used to manually set which direction it will go, and the stop button will remove movement and gravity altogether. For entities which cannot be flipped, such as munchers, a downward arrow will replace the auto, left, and right icons.

**Contents/gift** - Click the plus to insert a tile inside of the entity. For most entities, their contents will be released when it is killed. Once the contents have been set, click the tile’s icon to change the contents, or the X button to remove the tile. Middle click on the tile’s icon to quick-select it. If the tile is an entity, a popout icon will appear - clicking this will open the tile’s configuration menu. When editing an entity inside of another, a back arrow will appear in place of the keyboard shortcuts icon, which allows the user to go back to the parent entity.

**In block** - Whether the entity should be contained inside of a block. This option appears when the entity is in front of a block which can have something inside it.

**Turn at edges** - Whether to turn around before the entity falls off an edge.

**Progressive** - When the powerup spawns, it will turn into a mushroom if the player is small and this option is selected.

**Revert to mushroom** - If this option is not selected, the player will die instantly when they get hurt. Otherwise, the player’s state will revert back to that of a mushroom.

**Grabbable** - Whether the player can hold this item or block by holding the run button. Currently does nothing.

**Character (player)** - The character skin to select for this player.

**Powerup (player)** - The powerup to begin the level with.

**Invincibility star (player)** - Whether to have an invincibility star active at the start of the level.

**Type (large coins)** - The amount of coins to reward the player with. Selecting the star option  will give the player a special star coin instead.

**Force state (mushroom)** - If this option is selected, the player will be forced into mushroom state even if they have a powerup of higher priority.

**Mad (skipper)** - Whether to enter an angered state, where the entity is faster with lower jump height.

**Cursed (key)** - Whether to be a cursed key. If this option is selected, the player will lose a key when collected.

**Group (key coin)** - Which color group the key coin is part of.

**Door name (door)** - The name of the door. Used to identify the warp by, for use in the ‘warp to’ field.

**Warp to (door)** - Teleports the player to the specified door name when this one is interacted with.

**Type (door)** - The sprite of the door. Does not affect functionality.

**Modifiers (door)** - Can be changed to make the door locked or timed. Locked doors require a key to enter, and timed doors only appear when a timed switch is active.

**Reload area (door)** - Whether to reload the area when the door is entered. If this is enabled, it will reset the positions of entities and respawn killed ones.

**Surface (customizable block)** - The surface type of the block.

**Semisolid (customizable block)** - Which side of the block is solid.

**Hurts (customizable block)** - Which side of the block hurts the player.

**Destroyable (customizable block)** - Whether bumping from below or explosions can destroy the block.

**Player pass-through (customizable block)** - Whether the player can pass through the block entirely.

**Entity pass-through (customizable block)** - Whether entities excluding the player can pass through the block entirely.

**Invisible (customizable block)** - Whether the block requires a bump from below to appear.

**Message (sign)** - The message to display when interacted with.

**Font (sign)** - The font to display the message in.

**Colors (sign)** - The foreground and background colors to display the message in.

**Message in background (sign)** - If this option is not selected, it will display the message at any time when the sign is touching the player.

**Length (stone)** - The length of the stone.

**Vertical (stone)** - Whether the stone should be horizontal or vertical. This option appears when the length is greater than 1.

**Behavior (boom block)** - The behavior of the block when bumped or thrown. If this is set to ‘kill grounded enemies’, it will kill all onscreen enemies which are touching the ground. If this is set to ‘kill all enemies’, it will kill all onscreen enemies even if they’re in the air. If this is set to ‘destroy blocks’, it will destroy or activate nearby brick blocks as well as other boom blocks.

**Vertical (spring)** - The rotation of the spring.

**Powerful (spring)** - Whether to bounce entities super high or far.

# Tips and Tricks

### Placing entities inside blocks

When an entity is on the same tile as a block, it will shrink to the bottom-right corner of the tile to indicate that it is inside the block. It can be removed from the block by right-clicking the entity and disabling the “in block” option.
![coin menu](https://user-images.githubusercontent.com/95201497/227703089-2c716f7d-9505-41b9-aab8-ca1434e3def0.png)

### Changing the tile’s variant

Some blocks and entities have different versions of their current form, known as variants. Pressing A or D will cycle through the currently selected tile’s variant if it has any. Alternatively, right-click on a tile in the tile menu or hotbar to open a visual menu. Sometimes, a block’s variants will be rotated versions of it, such as the one-way wall.
![variant list](https://user-images.githubusercontent.com/95201497/227702956-f8257e52-5186-41bb-9ab7-d77d38036e11.png)

### Creating a door warp

To warp between two locations, first place two doors. Next, give them each a name by editing the ‘door name’ field in the entity configuration menu. Finally, select the opposite door’s name in the ‘warp to’ field for both doors.
![door menu](https://user-images.githubusercontent.com/95201497/227703002-53c2b01a-8705-45d6-a0ad-bc36ee6d16c4.png)

