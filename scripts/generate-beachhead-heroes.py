"""
Builds the two Beachhead commanders in Blender and renders a looping sprite sheet for each.

Run with Blender:  blender -b -P scripts/generate-beachhead-heroes.py
The sheets land in static/assets/beachhead/heroes/; the game plays them with a CSS steps() animation.
The models are deliberately low-poly and flat-coloured so they sit beside the canvas troops.
"""
import math
import os

import bpy
from mathutils import Vector

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "assets", "beachhead", "heroes")
W = H = 192
FRAMES = 12

# The game's palette, slightly lifted so the 3D reads well on the sand tiles
SKIN = (0.86, 0.65, 0.46, 1)
BEARD = (0.76, 0.76, 0.72, 1)
INK = (0.10, 0.11, 0.13, 1)
OLIVE = (0.36, 0.42, 0.26, 1)
STEEL = (0.27, 0.30, 0.34, 1)
DARK = (0.16, 0.18, 0.21, 1)
KHAKI = (0.68, 0.60, 0.40, 1)
GOLD = (0.86, 0.64, 0.14, 1)
RED = (0.68, 0.17, 0.16, 1)


def material(name, color, rough=0.85, metallic=0.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = metallic
    return mat


def put(obj, name, mat, parent=None, loc=(0, 0, 0), scale=(1, 1, 1), rot=(0, 0, 0)):
    obj.name = name
    obj.data.materials.append(mat)
    obj.parent = parent
    obj.location = loc
    obj.scale = scale
    obj.rotation_euler = rot
    obj.hide_render = False
    return obj


def sphere(name, mat, parent=None, loc=(0, 0, 0), scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=1)
    obj = bpy.context.object
    bpy.ops.object.shade_smooth()
    return put(obj, name, mat, parent, loc, scale)


def box(name, mat, parent=None, loc=(0, 0, 0), scale=(1, 1, 1), rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1)
    return put(bpy.context.object, name, mat, parent, loc, scale, rot)


def cylinder(name, mat, parent=None, loc=(0, 0, 0), radius=0.1, depth=1, verts=16, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth)
    return put(bpy.context.object, name, mat, parent, loc, (1, 1, 1), rot)


def empty(name, parent=None, loc=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    obj.location = loc
    return obj


def pennant(name, mat, parent, loc):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(0, 0, 0), (0.34, 0.0, 0.07), (0, 0, 0.24)], [], [(0, 1, 2)])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return put(obj, name, mat, parent, loc)


def face(hero, head, beard_color=BEARD):
    sphere(f"{hero} beard", material(f"{hero} beard", beard_color), head, (0, -0.05, -0.09), (0.21, 0.19, 0.13))
    sphere(f"{hero} nose", material(f"{hero} skin", SKIN), head, (0, -0.21, -0.01), (0.055, 0.06, 0.06))
    for side in (-1, 1):
        sphere(f"{hero} eye {side}", material(f"{hero} ink", INK), head, (side * 0.085, -0.2, 0.055), (0.028, 0.016, 0.03))


def legs(hero, root, cloth):
    for side in (-1, 1):
        cylinder(f"{hero} leg {side}", cloth, root, (side * 0.16, 0, 0.38), radius=0.115, depth=0.62)
        box(f"{hero} boot {side}", material(f"{hero} ink", INK), root, (side * 0.16, -0.06, 0.08), (0.26, 0.38, 0.16))


def arms(hero, root, cloth):
    out = {}
    for side in (-1, 1):
        shoulder = empty(f"{hero} shoulder {side}", root, (side * 0.36, 0, 1.16))
        cylinder(f"{hero} arm {side}", cloth, shoulder, (0, 0, -0.23), radius=0.105, depth=0.5)
        sphere(f"{hero} hand {side}", material(f"{hero} skin", SKIN), shoulder, (0, 0, -0.5), (0.11, 0.11, 0.11))
        out[side] = shoulder
    return out


def build_azov():
    hero = "azov"
    cloth = material("azov cloth", STEEL)
    root = empty("azov root")
    legs(hero, root, cloth)
    sphere("azov torso", cloth, root, (0, 0, 0.95), (0.36, 0.25, 0.42))
    box("azov rig", material("azov khaki", KHAKI), root, (0, -0.22, 0.95), (0.52, 0.12, 0.26))
    box("azov belt", material("azov ink", INK), root, (0, 0, 0.66), (0.62, 0.34, 0.1))
    head = empty("azov head", root, (0, 0, 1.48))
    sphere("azov face", material("azov skin", SKIN), head, scale=(0.23, 0.22, 0.24))
    face(hero, head)
    helmet = material("azov helmet", OLIVE)
    sphere("azov helmet", helmet, head, (0, 0.015, 0.1), (0.27, 0.26, 0.16))
    cylinder("azov helmet rim", helmet, head, (0, 0, 0.045), radius=0.27, depth=0.055)
    shoulders = arms(hero, root, cloth)
    gun = empty("azov gun", shoulders[1], (0, -0.05, -0.52))
    box("azov pistol", material("azov ink", INK), gun, (0, -0.14, 0), (0.11, 0.3, 0.09))
    box("azov grip", material("azov grip", DARK), gun, (0, -0.03, -0.12), (0.09, 0.09, 0.22))
    flash = sphere("azov flash", material("azov flash", GOLD), gun, (0, -0.32, 0), (0.11, 0.14, 0.11))
    flash.hide_render = True
    pole = empty("azov pennant", root, (-0.52, 0.16, 0))
    cylinder("azov pole", material("azov ink", INK), pole, (0, 0, 0.72), radius=0.022, depth=1.48)
    pennant("azov flag", material("azov flag", GOLD), pole, (0.03, 0, 1.36))
    return {"root": root, "head": head, "shoulders": shoulders, "flash": flash, "flag": pole, "objects": list(root.children_recursive) + [root]}


def build_prigozhin():
    hero = "hero"
    cloth = material("hero cloth", DARK)
    root = empty("hero root")
    legs(hero, root, cloth)
    sphere("hero torso", cloth, root, (0, 0, 0.95), (0.39, 0.26, 0.44))
    box("hero rig", material("hero khaki", KHAKI), root, (0, -0.23, 0.94), (0.54, 0.12, 0.24))
    head = empty("hero head", root, (0, 0, 1.5))
    sphere("hero face", material("hero skin", SKIN), head, scale=(0.24, 0.23, 0.25))
    face(hero, head)
    cap = material("hero cap", STEEL)
    cylinder("hero cap", cap, head, (0, 0, 0.2), radius=0.26, depth=0.13)
    box("hero cap peak", cap, head, (0, -0.23, 0.16), (0.4, 0.22, 0.06))
    shoulders = arms(hero, root, cloth)
    hammer = empty("hero hammer", shoulders[1], (0, 0, -0.53))
    cylinder("hero hammer handle", material("hero wood", KHAKI), hammer, (0, 0, 0.28), radius=0.035, depth=0.76)
    box("hero hammer head", material("hero gold", GOLD), hammer, (0, 0, 0.64), (0.4, 0.16, 0.2))
    pulse = sphere("hero pulse", material("hero pulse", (0.36, 0.82, 0.48, 1)), root, (0, -0.35, 0.9), (0.1, 0.1, 0.1))
    pulse.hide_render = True
    return {"root": root, "head": head, "shoulders": shoulders, "flash": pulse, "flag": None, "objects": list(root.children_recursive) + [root]}


def key(obj, path, frame, value):
    setattr(obj, path, value)
    obj.keyframe_insert(data_path=path, frame=frame)


def animate(parts, hero):
    root, shoulders, flash = parts["root"], parts["shoulders"], parts["flash"]
    for frame in range(1, FRAMES + 1):
        phase = (frame - 1) / FRAMES
        wave = math.sin(phase * math.tau)
        key(root, "location", frame, (0, 0, 0.025 * wave))
        key(shoulders[-1], "rotation_euler", frame, (0.12 * wave, 0, 0))
        key(shoulders[1], "rotation_euler", frame, (-0.12 * wave, 0, 0))
        # Attack: wind up, strike, recover. The hammer swings wider than the pistol.
        swing = 0.0
        if 3 <= frame <= 10:
            t = (frame - 3) / 7
            swing = -math.sin(t * math.pi) * (2.1 if hero == "hero" else 1.25)
        key(shoulders[1], "rotation_euler", frame, (-0.12 * wave + swing, 0, 0))
        flash.hide_render = frame not in (7, 8)
        if not flash.hide_render:
            flash.scale = ((0.16 if hero == "hero" else 0.12),) * 3
            flash.keyframe_insert(data_path="scale", frame=frame)
        else:
            flash.scale = (0.001, 0.001, 0.001)
            flash.keyframe_insert(data_path="scale", frame=frame)
        if parts["flag"]:
            key(parts["flag"], "rotation_euler", frame, (0, 0, 0.09 * math.sin(phase * math.tau * 2)))
    # Linear fcurves keep the loop even and predictable. Blender 5 stores them in layered actions.
    for action in bpy.data.actions:
        curves = []
        if hasattr(action, "fcurves"):
            curves = list(action.fcurves)
        else:
            for layer in action.layers:
                for strip in layer.strips:
                    for bag in strip.channelbags:
                        curves.extend(bag.fcurves)
        for fcurve in curves:
            for point in fcurve.keyframe_points:
                point.interpolation = "LINEAR"


def setup_scene():
    scene = bpy.context.scene
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.studio_light = "paint.sl"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.show_cavity = True
    scene.display.shading.cavity_type = "BOTH"
    scene.display.shading.show_shadows = True
    scene.render.resolution_x = W
    scene.render.resolution_y = H
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.frame_start = 1
    scene.frame_end = FRAMES
    scene.render.fps = 12
    camera = bpy.data.objects.new("Hero camera", bpy.data.cameras.new("Hero camera"))
    scene.collection.objects.link(camera)
    camera.location = (2.7, -4.6, 2.2)
    camera.rotation_euler = (Vector((0, 0, 0.95)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 2.1
    scene.camera = camera
    return scene


def build_all():
    scene = setup_scene()
    heroes = {"azov": build_azov(), "hero": build_prigozhin()}
    for name, parts in heroes.items():
        animate(parts, name)
    scene.frame_set(1)
    return heroes


def render_sheet(name, parts):
    scene = bpy.context.scene
    other = "hero" if name == "azov" else "azov"
    for obj in parts[other]["objects"]:
        obj.hide_render = True
    effect = f"{name} flash" if name == "azov" else "hero pulse"
    sheet = bpy.data.images.new(f"{name} sheet", width=W * FRAMES, height=H, alpha=True)
    pixels = [0.0] * (W * H * 4 * FRAMES)
    scratch = f"/tmp/ww3-{name}-frame.png"
    scene.render.filepath = scratch
    for frame in range(1, FRAMES + 1):
        scene.frame_set(frame)
        for obj in parts[name]["objects"]:
            obj.hide_render = obj.name == effect and frame not in (7, 8)
        bpy.ops.render.render(write_still=True)
        image = bpy.data.images.load(scratch, check_existing=False)
        src = list(image.pixels)
        start = (frame - 1) * W * 4
        for row in range(H):
            offset = start + row * W * 4 * FRAMES
            pixels[offset:offset + W * 4] = src[row * W * 4:(row + 1) * W * 4]
        bpy.data.images.remove(image)
    sheet.pixels.foreach_set(pixels)
    out = os.path.join(OUT_DIR, f"{name}.png")
    sheet.filepath_raw = out
    sheet.file_format = "PNG"
    sheet.save()
    bpy.data.images.remove(sheet)
    if os.path.exists(scratch):
        os.remove(scratch)
    return out


def render_all():
    os.makedirs(OUT_DIR, exist_ok=True)
    parts = globals().get("WW3_PARTS") or build_all()
    return {name: render_sheet(name, parts[name]) for name in ("azov", "hero")}


task = globals().get("WW3_TASK", "all" if globals().get("__name__") == "__main__" else "none")
if task == "build":
    WW3_PARTS = build_all()
elif task == "render":
    render_all()
elif task == "all":
    render_all()
