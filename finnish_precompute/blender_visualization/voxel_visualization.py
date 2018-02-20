# Imports a text file where each line contains
# the space-separated integer coordinates x y z
# (on the voxel grid, not the scene space) of a voxel,
# and adds them as cubes to the current scene

filename = bpy.path.abspath("//..\\voxels.dat")


center_voxel_scene = True
automatic_scale = True
points_only = False            # Set to true for better performance


import sys

if len(sys.argv) == 5:
	filename, center_voxel_scene, automatic_scale, points_only = sys.argv[1:]
	print(filename, center_voxel_scene, automatic_scale, points_only)

import bpy
from mathutils import Vector


def load_voxels(filename):
    with open(filename) as f:
        return [Vector(map(float, line.split())) for line in f.readlines() if len(line) > 0]

def get_voxel_material():
    material = bpy.data.materials.get("VoxelMaterial")
    if material is None:
        material = bpy.data.materials.new(name="VoxelMaterial")
        material.diffuse_color = (0.227, 1, 0.558)
    return material
        
def select_voxel_scene_object():
    bpy.data.objects["VoxelScene"].select = True
                
def remove_voxel_scene_objects():
    if "VoxelScene" in bpy.data.objects:
        bpy.ops.object.select_all(action='DESELECT')
        select_voxel_scene_object()
        bpy.ops.object.select_by_type(type='MESH')
        bpy.ops.object.delete(use_global=False)
        for item in bpy.data.meshes:
            bpy.data.meshes.remove(item)
        if "Voxel" in bpy.data.objects:
            bpy.data.objects["Voxel"].select = True
        bpy.ops.object.delete()

def get_voxel_scene_size(voxels):
    min_voxel = Vector(map(min, zip(*voxels)))
    max_voxel = Vector(map(max, zip(*voxels)))
    return max_voxel - min_voxel

def get_min_voxel(voxels):
    return Vector(map(min, zip(*voxels)))

def get_position_offset(min_voxel, voxel_scene_size):
    voxel_size_xy = Vector((voxel_scene_size[0], voxel_scene_size[1], 0.0))
    return -(min_voxel + 0.5 * voxel_size_xy)

def get_scale_and_offset(voxels, center_voxel_scene, automatic_scale):
    min_voxel = get_min_voxel(voxels)
    voxel_scene_size = get_voxel_scene_size(voxels)
    if center_voxel_scene:
        offset = get_position_offset(min_voxel, voxel_scene_size)
    else:
        offset = Vector((0,0,0))
    automatic_scale_target_size = 16.0
    if automatic_scale:
        scale = automatic_scale_target_size / max(voxel_scene_size)
    else:
        scale = 1.0
    return scale, offset

def generate_point_cloud(points):
    mesh_data = bpy.data.meshes.new("PointCloud")
    mesh_data.from_pydata(points, [], [])
    mesh_data.update()
    obj = bpy.data.objects.new("VoxelScene", mesh_data)
    scene = bpy.context.scene
    scene.objects.link(obj)
    obj.select = True
    return obj

def set_duplivert_cube(point_cloud, material, scale):
    bpy.ops.mesh.primitive_cube_add(location=(0,0,0), radius=scale*0.5)
    ob = bpy.context.object
    ob.name = "Voxel"
    ob.data.materials.append(material)
    ob.select = True
    bpy.context.scene.objects.active = point_cloud

    bpy.ops.object.parent_set(type='OBJECT')
    bpy.context.object.dupli_type = 'VERTS'


bpy.ops.object.select_all(action='DESELECT') # deselect on progress start to give indication of something loading
bpy.ops.wm.redraw_timer(type='DRAW_WIN_SWAP', iterations=1) # make sure the deselected scene is drawn

voxels = load_voxels(filename)

remove_voxel_scene_objects()
material = get_voxel_material()
scale, offset = get_scale_and_offset(voxels, center_voxel_scene, automatic_scale)

points = [scale * (offset + Vector((0.5,0.5,0.5)) + voxel) for voxel in voxels]
point_cloud = generate_point_cloud(points)
if not points_only:
    set_duplivert_cube(point_cloud, material, scale)

select_voxel_scene_object() # select voxel scene object to show that loading is finished

