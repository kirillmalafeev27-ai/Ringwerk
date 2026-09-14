import bpy
import json
import math
import os
from mathutils import Vector


OUT_DIR = r"C:\Users\pc\AppData\Local\Temp\conveyor-blender-assets"
BLEND_PATH = os.path.join(OUT_DIR, "conveyor_factory_kit.blend")
GLB_PATH = os.path.join(OUT_DIR, "conveyor_factory_kit.glb")
PREVIEW_PATH = os.path.join(OUT_DIR, "conveyor_factory_kit_preview.png")
MANIFEST_PATH = os.path.join(OUT_DIR, "conveyor_factory_kit_manifest.json")


def clean_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials,
                       bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


clean_scene()
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1440
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.render.image_settings.color_mode = "RGB"
scene.render.image_settings.color_depth = "8"
scene.render.image_settings.compression = 15
scene.render.filepath = PREVIEW_PATH
scene.render.resolution_percentage = 100
scene.view_settings.look = "AgX - Medium High Contrast"
scene.world.color = (0.008, 0.012, 0.022)

assets_col = bpy.data.collections.new("CONVEYOR_FACTORY_KIT")
scene.collection.children.link(assets_col)
preview_col = bpy.data.collections.new("PREVIEW_ONLY")
scene.collection.children.link(preview_col)


def move_to_collection(obj, collection):
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def make_material(name, color, metallic=0.0, roughness=0.45,
                  emission=None, emission_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission:
        emission_input = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
        strength_input = bsdf.inputs.get("Emission Strength")
        if emission_input:
            emission_input.default_value = (*emission, 1.0)
        if strength_input:
            strength_input.default_value = emission_strength
    return mat


MAT = {
    "steel_dark": make_material("M_Steel_Dark", (0.035, 0.055, 0.075), 0.78, 0.25),
    "steel_blue": make_material("M_Steel_Blue", (0.055, 0.17, 0.25), 0.65, 0.28),
    "steel_light": make_material("M_Steel_Light", (0.28, 0.36, 0.42), 0.8, 0.22),
    "rubber": make_material("M_Rubber_Belt", (0.018, 0.024, 0.029), 0.05, 0.72),
    "yellow": make_material("M_Safety_Yellow", (0.98, 0.55, 0.025), 0.28, 0.3),
    "orange": make_material("M_Worker_Orange", (0.95, 0.23, 0.045), 0.22, 0.34),
    "white": make_material("M_Ceramic_White", (0.78, 0.86, 0.88), 0.12, 0.4),
    "black": make_material("M_Hazard_Black", (0.012, 0.017, 0.021), 0.25, 0.5),
    "cyan": make_material("M_Glow_Cyan", (0.02, 0.46, 0.62), 0.25, 0.25,
                          (0.0, 0.72, 1.0), 5.0),
    "green": make_material("M_Glow_Green", (0.025, 0.42, 0.16), 0.2, 0.3,
                           (0.03, 1.0, 0.28), 4.5),
    "red": make_material("M_Warning_Red", (0.62, 0.025, 0.025), 0.25, 0.33,
                         (1.0, 0.02, 0.0), 3.0),
    "heat": make_material("M_Furnace_Heat", (0.95, 0.12, 0.015), 0.0, 0.34,
                          (1.0, 0.13, 0.0), 8.0),
    "amber": make_material("M_Beacon_Amber", (0.95, 0.22, 0.015), 0.05, 0.2,
                           (1.0, 0.17, 0.0), 7.0),
}


def assign_material(obj, material):
    if obj.data and hasattr(obj.data, "materials"):
        obj.data.materials.append(material)


def apply_transform(obj):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.select_set(False)


def bevel(obj, width=0.06, segments=2):
    mod = obj.modifiers.new("EdgeSoftener", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.select_set(False)


def root(name, location):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.35
    obj.location = location
    obj["asset_type"] = name.replace("ASSET_", "")
    obj["web_ready"] = True
    assets_col.objects.link(obj)
    return obj


def cube(name, parent, loc, dims, mat, rot=(0, 0, 0), edge=0.05):
    bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    move_to_collection(obj, assets_col)
    obj.dimensions = dims
    obj.rotation_euler = rot
    apply_transform(obj)
    if edge:
        bevel(obj, min(edge, min(dims) * 0.25), 2)
    obj.parent = parent
    obj.location = loc
    assign_material(obj, mat)
    return obj


def cylinder(name, parent, loc, radius, depth, mat, rot=(0, 0, 0), vertices=16,
             smooth=False, edge=0.025):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth,
                                       location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    move_to_collection(obj, assets_col)
    obj.rotation_euler = rot
    apply_transform(obj)
    if edge:
        bevel(obj, min(edge, radius * 0.15, depth * 0.1), 2)
    if smooth:
        for poly in obj.data.polygons:
            poly.use_smooth = True
    obj.parent = parent
    obj.location = loc
    assign_material(obj, mat)
    return obj


def sphere(name, parent, loc, radius, mat, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=radius, location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    move_to_collection(obj, assets_col)
    obj.scale = scale
    apply_transform(obj)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    obj.parent = parent
    obj.location = loc
    assign_material(obj, mat)
    return obj


def torus(name, parent, loc, major, minor, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor,
                                    major_segments=24, minor_segments=8,
                                    location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    move_to_collection(obj, assets_col)
    obj.rotation_euler = rot
    apply_transform(obj)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    obj.parent = parent
    obj.location = loc
    assign_material(obj, mat)
    return obj


def cone(name, parent, loc, r1, r2, depth, mat, rot=(0, 0, 0), vertices=16):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2,
                                   depth=depth, location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    move_to_collection(obj, assets_col)
    obj.rotation_euler = rot
    apply_transform(obj)
    bevel(obj, min(0.025, depth * 0.05), 2)
    obj.parent = parent
    obj.location = loc
    assign_material(obj, mat)
    return obj


def gear_disc(name, parent, loc, outer_radius, inner_radius, thickness, teeth, mat):
    count = teeth * 2
    verts = []
    for y in (-thickness / 2, thickness / 2):
        for i in range(count):
            angle = math.tau * i / count
            radius = outer_radius if i % 2 == 0 else inner_radius
            verts.append((math.cos(angle) * radius, y, math.sin(angle) * radius))
    faces = []
    faces.append(tuple(range(count - 1, -1, -1)))
    faces.append(tuple(range(count, count * 2)))
    for i in range(count):
        ni = (i + 1) % count
        faces.append((i, ni, count + ni, count + i))
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    assets_col.objects.link(obj)
    obj.parent = parent
    obj.location = loc
    assign_material(obj, mat)
    bevel(obj, 0.018, 1)
    return obj


asset_roots = []


# Conveyor segment ----------------------------------------------------------
r = root("ASSET_Conveyor_Segment", (-6.2, 4.2, 0.0))
asset_roots.append(r)
cube("Conveyor_Frame_Left", r, (0, -1.03, 0.63), (5.2, 0.18, 0.42), MAT["steel_blue"], edge=0.07)
cube("Conveyor_Frame_Right", r, (0, 1.03, 0.63), (5.2, 0.18, 0.42), MAT["steel_blue"], edge=0.07)
cube("Conveyor_Belt", r, (0, 0, 0.78), (5.0, 1.83, 0.14), MAT["rubber"], edge=0.05)
for i in range(9):
    x = -2.2 + i * 0.55
    cylinder(f"Conveyor_Roller_{i+1:02d}", r, (x, 0, 0.69), 0.14, 1.96,
             MAT["steel_light"], rot=(math.pi / 2, 0, 0), vertices=12, smooth=True)
for x in (-2.15, 2.15):
    cube(f"Conveyor_Leg_{'L' if x < 0 else 'R'}_A", r, (x, -0.82, 0.28),
         (0.2, 0.2, 0.58), MAT["steel_dark"], edge=0.035)
    cube(f"Conveyor_Leg_{'L' if x < 0 else 'R'}_B", r, (x, 0.82, 0.28),
         (0.2, 0.2, 0.58), MAT["steel_dark"], edge=0.035)
cube("Conveyor_Safety_Rail_Left", r, (0, -1.17, 0.97), (5.25, 0.08, 0.12), MAT["yellow"], edge=0.025)
cube("Conveyor_Safety_Rail_Right", r, (0, 1.17, 0.97), (5.25, 0.08, 0.12), MAT["yellow"], edge=0.025)


# Press --------------------------------------------------------------------
r = root("ASSET_Hydraulic_Press", (0.0, 4.2, 0.0))
asset_roots.append(r)
cube("Press_Base", r, (0, 0, 0.18), (3.1, 2.35, 0.36), MAT["steel_dark"], edge=0.1)
cube("Press_Bed", r, (0, 0, 0.62), (2.55, 1.78, 0.35), MAT["steel_light"], edge=0.07)
for x in (-1.2, 1.2):
    cube(f"Press_Pillar_{'L' if x < 0 else 'R'}", r, (x, 0, 2.1),
         (0.36, 1.86, 3.62), MAT["steel_blue"], edge=0.1)
cube("Press_Crown", r, (0, 0, 3.82), (3.12, 2.05, 0.62), MAT["steel_blue"], edge=0.12)
cylinder("Press_Hydraulic_Cylinder", r, (0, 0, 3.2), 0.45, 1.0,
         MAT["steel_light"], vertices=20, smooth=True)
cylinder("Press_Ram", r, (0, 0, 2.35), 0.23, 1.18,
         MAT["steel_light"], vertices=16, smooth=True)
cube("Press_Die", r, (0, 0, 1.65), (1.35, 1.3, 0.34), MAT["yellow"], edge=0.06)
cube("Press_Warning_L", r, (-1.52, -1.02, 1.15), (0.1, 0.12, 1.65), MAT["yellow"], edge=0.02)
cube("Press_Warning_R", r, (1.52, -1.02, 1.15), (0.1, 0.12, 1.65), MAT["yellow"], edge=0.02)


# Furnace portal ------------------------------------------------------------
r = root("ASSET_Furnace_Portal", (5.3, 4.2, 0.0))
asset_roots.append(r)
cube("Furnace_Base", r, (0, 0, 0.17), (3.65, 2.0, 0.34), MAT["steel_dark"], edge=0.1)
cube("Furnace_Jamb_Left", r, (-1.45, 0, 1.95), (0.58, 1.75, 3.62), MAT["steel_blue"], edge=0.11)
cube("Furnace_Jamb_Right", r, (1.45, 0, 1.95), (0.58, 1.75, 3.62), MAT["steel_blue"], edge=0.11)
cube("Furnace_Header", r, (0, 0, 3.58), (3.45, 1.75, 0.6), MAT["steel_blue"], edge=0.13)
cube("Furnace_Heat_Core", r, (0, 0.56, 1.95), (2.35, 0.18, 2.8), MAT["heat"], edge=0.08)
for x in (-1.48, 1.48):
    cylinder(f"Furnace_Pipe_{'L' if x < 0 else 'R'}", r, (x, 0.45, 2.2), 0.13, 3.3,
             MAT["steel_light"], vertices=12, smooth=True)
for x in (-0.7, 0, 0.7):
    cone(f"Furnace_Flame_{int((x+0.7)*10):02d}", r, (x, -0.62, 0.78),
         0.25, 0.05, 1.05, MAT["amber"], vertices=10)


# Transverse saw ------------------------------------------------------------
r = root("ASSET_Transverse_Saw", (-6.2, -0.6, 0.0))
asset_roots.append(r)
cube("Saw_Base", r, (0, 0, 0.22), (4.3, 2.25, 0.44), MAT["steel_dark"], edge=0.1)
cube("Saw_Table", r, (0, 0, 0.82), (4.1, 2.05, 0.23), MAT["steel_light"], edge=0.055)
for x in (-1.7, 1.7):
    cube(f"Saw_Arch_{'L' if x < 0 else 'R'}", r, (x, 0.48, 2.03),
         (0.26, 0.3, 2.35), MAT["steel_blue"], edge=0.07)
cube("Saw_Crossbeam", r, (0, 0.48, 3.11), (3.65, 0.38, 0.36), MAT["steel_blue"], edge=0.08)
gear_disc("Saw_Blade", r, (0, -0.08, 1.95), 1.22, 1.02, 0.16, 18, MAT["steel_light"])
cylinder("Saw_Blade_Hub", r, (0, -0.08, 1.95), 0.23, 0.28,
         MAT["yellow"], rot=(math.pi / 2, 0, 0), vertices=16, smooth=True)
cube("Saw_Guard_Top", r, (0, 0.05, 2.78), (2.0, 0.3, 0.28), MAT["yellow"], edge=0.08)


# Piston --------------------------------------------------------------------
r = root("ASSET_Industrial_Piston", (-1.2, -0.6, 0.0))
asset_roots.append(r)
cube("Piston_Base", r, (0, 0, 0.2), (2.45, 2.1, 0.4), MAT["steel_dark"], edge=0.1)
cylinder("Piston_Main_Barrel", r, (0, 0, 1.65), 0.72, 2.35,
         MAT["steel_blue"], vertices=20, smooth=True)
cylinder("Piston_Rod", r, (0, 0, 3.18), 0.34, 1.25,
         MAT["steel_light"], vertices=16, smooth=True)
cube("Piston_Strike_Plate", r, (0, 0, 3.88), (1.65, 1.48, 0.28), MAT["yellow"], edge=0.08)
for x in (-0.9, 0.9):
    cylinder(f"Piston_Return_{'L' if x < 0 else 'R'}", r, (x, 0, 1.25), 0.14, 1.95,
             MAT["steel_light"], vertices=12, smooth=True)
    cube(f"Piston_Foot_{'L' if x < 0 else 'R'}", r, (x, 0, 0.55),
         (0.28, 1.35, 0.28), MAT["yellow"], edge=0.05)


# Turbine -------------------------------------------------------------------
r = root("ASSET_Ventilation_Turbine", (4.3, -0.6, 0.0))
asset_roots.append(r)
cube("Turbine_Base", r, (0, 0.18, 0.22), (3.2, 1.65, 0.44), MAT["steel_dark"], edge=0.1)
cube("Turbine_Stand_L", r, (-1.15, 0.22, 1.65), (0.26, 0.45, 2.65), MAT["steel_blue"], edge=0.07)
cube("Turbine_Stand_R", r, (1.15, 0.22, 1.65), (0.26, 0.45, 2.65), MAT["steel_blue"], edge=0.07)
torus("Turbine_Guard_Ring", r, (0, 0, 2.15), 1.35, 0.16, MAT["yellow"], rot=(math.pi / 2, 0, 0))
cylinder("Turbine_Hub", r, (0, 0, 2.15), 0.34, 0.54,
         MAT["steel_light"], rot=(math.pi / 2, 0, 0), vertices=20, smooth=True)
for i in range(8):
    a = math.tau * i / 8
    x = math.cos(a) * 0.72
    z = 2.15 + math.sin(a) * 0.72
    cube(f"Turbine_Blade_{i+1:02d}", r, (x, 0.03, z), (0.92, 0.18, 0.27),
         MAT["steel_light"], rot=(0, -a, 0), edge=0.06)


# Hero worker drone ---------------------------------------------------------
r = root("ASSET_Hero_Worker_Drone", (-5.6, -5.2, 0.0))
asset_roots.append(r)
cube("Hero_Torso", r, (0, 0, 1.02), (0.95, 0.68, 0.78), MAT["orange"], edge=0.18)
cube("Hero_Head", r, (0, 0, 1.72), (0.88, 0.72, 0.63), MAT["white"], edge=0.2)
cube("Hero_Visor", r, (0, -0.37, 1.72), (0.62, 0.08, 0.26), MAT["cyan"], edge=0.07)
sphere("Hero_Helmet", r, (0, 0.02, 2.04), 0.53, MAT["yellow"], scale=(1.05, 0.78, 0.42))
cube("Hero_Helmet_Brim", r, (0, -0.1, 1.97), (1.03, 0.76, 0.12), MAT["yellow"], edge=0.05)
for x in (-0.62, 0.62):
    cylinder(f"Hero_Arm_{'L' if x < 0 else 'R'}", r, (x, 0, 1.02), 0.13, 0.73,
             MAT["orange"], rot=(0, 0.18 if x < 0 else -0.18, 0), vertices=12, smooth=True)
    sphere(f"Hero_Hand_{'L' if x < 0 else 'R'}", r, (x, 0, 0.6), 0.17, MAT["steel_light"])
for x in (-0.27, 0.27):
    cube(f"Hero_Leg_{'L' if x < 0 else 'R'}", r, (x, 0, 0.37),
         (0.25, 0.31, 0.7), MAT["steel_blue"], edge=0.08)
    cube(f"Hero_Boot_{'L' if x < 0 else 'R'}", r, (x, -0.1, 0.09),
         (0.34, 0.51, 0.2), MAT["steel_dark"], edge=0.07)
cube("Hero_Chest_Badge", r, (0, -0.36, 1.08), (0.34, 0.06, 0.27), MAT["cyan"], edge=0.045)


# Terminal ------------------------------------------------------------------
r = root("ASSET_Control_Terminal", (-1.1, -5.2, 0.0))
asset_roots.append(r)
cube("Terminal_Base", r, (0, 0, 0.13), (1.55, 1.2, 0.26), MAT["steel_dark"], edge=0.08)
cube("Terminal_Pedestal", r, (0, 0.16, 0.95), (0.7, 0.66, 1.58), MAT["steel_blue"], edge=0.12)
cube("Terminal_Console", r, (0, -0.12, 1.82), (1.45, 0.55, 0.95), MAT["steel_light"], rot=(-0.16, 0, 0), edge=0.14)
cube("Terminal_Screen", r, (0, -0.41, 1.86), (1.05, 0.07, 0.54), MAT["cyan"], rot=(-0.16, 0, 0), edge=0.07)
for i, mat in enumerate((MAT["green"], MAT["yellow"], MAT["red"])):
    cylinder(f"Terminal_Button_{i+1}", r, (-0.38 + i * 0.38, -0.45, 1.48), 0.08, 0.07,
             mat, rot=(math.pi / 2, 0, 0), vertices=12, smooth=True, edge=0.01)


# Exit gate -----------------------------------------------------------------
r = root("ASSET_Exit_Gate", (4.1, -5.2, 0.0))
asset_roots.append(r)
cube("Exit_Base", r, (0, 0, 0.16), (3.75, 1.3, 0.32), MAT["steel_dark"], edge=0.08)
cube("Exit_Pillar_Left", r, (-1.35, 0, 1.85), (0.45, 0.75, 3.5), MAT["steel_blue"], edge=0.1)
cube("Exit_Pillar_Right", r, (1.35, 0, 1.85), (0.45, 0.75, 3.5), MAT["steel_blue"], edge=0.1)
cube("Exit_Header", r, (0, 0, 3.48), (3.1, 0.82, 0.56), MAT["steel_blue"], edge=0.12)
cube("Exit_Glow_Left", r, (-1.36, -0.4, 1.85), (0.14, 0.08, 2.9), MAT["green"], edge=0.03)
cube("Exit_Glow_Right", r, (1.36, -0.4, 1.85), (0.14, 0.08, 2.9), MAT["green"], edge=0.03)
cube("Exit_Sign", r, (0, -0.44, 3.46), (1.55, 0.08, 0.34), MAT["green"], edge=0.07)
cube("Exit_Arrow_Shaft", r, (-0.08, -0.49, 3.46), (0.72, 0.05, 0.11), MAT["white"], edge=0.02)
cube("Exit_Arrow_Head_A", r, (0.31, -0.49, 3.57), (0.37, 0.05, 0.11), MAT["white"], rot=(0, -math.pi / 4, 0), edge=0.02)
cube("Exit_Arrow_Head_B", r, (0.31, -0.49, 3.35), (0.37, 0.05, 0.11), MAT["white"], rot=(0, math.pi / 4, 0), edge=0.02)


# Warning beacon ------------------------------------------------------------
r = root("ASSET_Warning_Beacon", (-2.7, -8.4, 0.0))
asset_roots.append(r)
cylinder("Beacon_Base", r, (0, 0, 0.13), 0.55, 0.26, MAT["steel_dark"], vertices=16, smooth=True)
cylinder("Beacon_Pole", r, (0, 0, 0.85), 0.1, 1.35, MAT["steel_light"], vertices=12, smooth=True)
cylinder("Beacon_Lamp", r, (0, 0, 1.65), 0.34, 0.58, MAT["amber"], vertices=16, smooth=True)
cone("Beacon_Cap", r, (0, 0, 2.05), 0.4, 0.2, 0.28, MAT["yellow"], vertices=16)
torus("Beacon_Guard_Upper", r, (0, 0, 1.88), 0.36, 0.035, MAT["steel_dark"])
torus("Beacon_Guard_Lower", r, (0, 0, 1.42), 0.36, 0.035, MAT["steel_dark"])


# Floor plate ---------------------------------------------------------------
r = root("ASSET_Floor_Plate", (2.2, -8.4, 0.0))
asset_roots.append(r)
cube("Floor_Plate_Base", r, (0, 0, 0.09), (4.0, 2.7, 0.18), MAT["steel_dark"], edge=0.06)
cube("Floor_Plate_Inset", r, (0, 0, 0.2), (3.5, 2.2, 0.08), MAT["steel_light"], edge=0.04)
for i in range(8):
    x = -1.72 + i * 0.49
    cube(f"Floor_Hazard_Stripe_{i+1:02d}", r, (x, -1.19, 0.26), (0.34, 0.26, 0.07),
         MAT["yellow"] if i % 2 == 0 else MAT["black"], rot=(0, 0, -0.35), edge=0.015)
for x in (-1.72, 1.72):
    for y in (-0.94, 0.94):
        cylinder(f"Floor_Bolt_{'L' if x < 0 else 'R'}_{'F' if y < 0 else 'B'}",
                 r, (x, y, 0.28), 0.075, 0.05, MAT["yellow"], vertices=8, smooth=False)


# Per-asset metadata and dimensions ----------------------------------------
def asset_bounds(asset_root):
    inv = asset_root.matrix_world.inverted()
    points = []
    for obj in asset_root.children_recursive:
        if obj.type != "MESH":
            continue
        for corner in obj.bound_box:
            points.append(inv @ (obj.matrix_world @ Vector(corner)))
    mins = [min(p[i] for p in points) for i in range(3)]
    maxs = [max(p[i] for p in points) for i in range(3)]
    return [round(maxs[i] - mins[i], 3) for i in range(3)], mins, maxs


bpy.context.view_layer.update()

manifest = {
    "format": "Conveyor Factory Kit 1.0",
    "units": "meters",
    "up_axis": "Y in GLB / Z in Blender",
    "assets": [],
}
for asset_root in asset_roots:
    dims, mins, maxs = asset_bounds(asset_root)
    asset_root["dimensions_m"] = dims
    asset_root["origin_rule"] = "ground-center"
    manifest["assets"].append({
        "root": asset_root.name,
        "dimensions_m_xyz": dims,
        "origin": "ground-center",
        "objects": sorted(obj.name for obj in asset_root.children_recursive),
    })


# Preview stage -------------------------------------------------------------
bpy.ops.mesh.primitive_plane_add(size=2, location=(0, -1.7, -0.12))
stage = bpy.context.object
stage.name = "PREVIEW_Stage"
move_to_collection(stage, preview_col)
stage.scale = (7.8, 7.0, 1)
apply_transform(stage)
stage_mat = make_material("M_Preview_Floor", (0.012, 0.022, 0.032), 0.25, 0.48)
assign_material(stage, stage_mat)

for y in (-2.9, 1.8, 6.5):
    cube_obj = None
    bpy.ops.mesh.primitive_cube_add(location=(0, y, -0.055), scale=(7.6, 0.018, 0.012))
    cube_obj = bpy.context.object
    cube_obj.name = f"PREVIEW_GridLine_{y:+.1f}"
    move_to_collection(cube_obj, preview_col)
    assign_material(cube_obj, MAT["cyan"])


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


bpy.ops.object.camera_add(location=(17.8, -23.5, 19.0))
camera = bpy.context.object
camera.name = "PREVIEW_Camera"
move_to_collection(camera, preview_col)
camera.data.type = "ORTHO"
camera.data.ortho_scale = 21.0
look_at(camera, (0, -1.7, 1.7))
scene.camera = camera

def add_area(name, loc, energy, color, size):
    data = bpy.data.lights.new(name + "_Data", "AREA")
    data.energy = energy
    data.color = color
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    preview_col.objects.link(obj)
    obj.location = loc
    look_at(obj, (0, -1.0, 1.4))
    return obj


add_area("PREVIEW_Key", (-8, -10, 16), 1900, (0.65, 0.82, 1.0), 7.0)
add_area("PREVIEW_Fill", (11, -3, 9), 1450, (1.0, 0.48, 0.18), 6.0)
add_area("PREVIEW_Rim", (0, 10, 13), 1750, (0.12, 0.55, 1.0), 5.0)


# Export only reusable asset nodes, excluding stage/camera/lights.
bpy.ops.object.select_all(action="DESELECT")
for obj in assets_col.all_objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = asset_roots[0]
bpy.ops.export_scene.gltf(
    filepath=GLB_PATH,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_cameras=False,
    export_lights=False,
    export_extras=True,
    export_materials="EXPORT",
)

with open(MANIFEST_PATH, "w", encoding="utf-8") as handle:
    json.dump(manifest, handle, ensure_ascii=False, indent=2)

bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH, compress=True)
bpy.ops.render.render(write_still=True)

print("ASSET_BUILD_COMPLETE")
print(json.dumps(manifest, ensure_ascii=False))
print(BLEND_PATH)
print(GLB_PATH)
print(PREVIEW_PATH)
