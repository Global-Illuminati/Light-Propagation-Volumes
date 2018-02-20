# Imports a text file where each line contains
# the scene-space coordinates x y z of a probe,
# and adds them as a point cloud to the current scene

filename = bpy.path.abspath("//..\\probes.dat")


center_probes_scene = False
automatic_scale = False
points_only = False            # Set to true for better performance


import sys

if len(sys.argv) == 5:
	filename, center_probe_scene, automatic_scale, points_only = sys.argv[1:]
	print(filename, center_probes_scene, automatic_scale, points_only)

import bpy
from mathutils import Vector


def load_probes(filename):
    with open(filename) as f:
        return [Vector(map(float, line.split())) for line in f.readlines() if len(line) > 0]

def get_probe_material():
    material = bpy.data.materials.get("ProbeMaterial")
    if material is None:
        material = bpy.data.materials.new(name="ProbeMaterial")
        material.diffuse_color = (0, 1, 0)
        material.use_shadeless = True
    return material
        
def select_probe_scene_object():
    bpy.data.objects["ProbeScene"].select = True
                
def remove_probe_scene_objects():
    if "ProbeScene" in bpy.data.objects:
        bpy.ops.object.select_all(action='DESELECT')
        select_probe_scene_object()
        #bpy.ops.object.select_by_type(type='MESH')
        bpy.ops.object.delete(use_global=False)
        #for item in bpy.data.meshes:
        #    bpy.data.meshes.remove(item)
        if "Probe" in bpy.data.objects:
            bpy.data.objects["Probe"].select = True
        bpy.ops.object.delete()

def get_probe_scene_size(probes):
    min_probe = Vector(map(min, zip(*probes)))
    max_probe = Vector(map(max, zip(*probes)))
    return max_probe - min_probe

def get_min_probe(probes):
    return Vector(map(min, zip(*probes)))

def get_position_offset(min_probe, probe_scene_size):
    probe_size_xy = Vector((probe_scene_size[0], probe_scene_size[1], 0.0))
    return -(min_probe + 0.5 * probe_size_xy)

def get_scale_and_offset(probes, center_probe_scene, automatic_scale):
    min_probe = get_min_probe(probes)
    probe_scene_size = get_probe_scene_size(probes)
    if center_probe_scene:
        offset = get_position_offset(min_probe, probe_scene_size)
    else:
        offset = Vector((0,0,0))
    automatic_scale_target_size = 16.0
    if automatic_scale:
        scale = automatic_scale_target_size / max(probe_scene_size)
    else:
        scale = 1.0
    return scale, offset

def generate_point_cloud(points):
    mesh_data = bpy.data.meshes.new("PointCloud")
    mesh_data.from_pydata(points, [], [])
    mesh_data.update()
    obj = bpy.data.objects.new("ProbeScene", mesh_data)
    scene = bpy.context.scene
    scene.objects.link(obj)
    obj.select = True
    return obj

def set_duplivert_sphere(point_cloud, material, scale):
    bpy.ops.mesh.primitive_uv_sphere_add(location=(0,0,0), size=scale*0.2)
    ob = bpy.context.object
    ob.name = "Probe"
    ob.data.materials.append(material)
    ob.select = True
    bpy.ops.object.shade_smooth()
    bpy.context.scene.objects.active = point_cloud

    bpy.ops.object.parent_set(type='OBJECT')
    bpy.context.object.dupli_type = 'VERTS'


bpy.ops.object.select_all(action='DESELECT') # deselect on progress start to give indication of something loading
bpy.ops.wm.redraw_timer(type='DRAW_WIN_SWAP', iterations=1) # make sure the deselected scene is drawn

probes = load_probes(filename)

remove_probe_scene_objects()
material = get_probe_material()
scale, offset = get_scale_and_offset(probes, center_probe_scene, automatic_scale)

points = [scale * (offset + probe) for probe in probes]
point_cloud = generate_point_cloud(points)
if not points_only:
    set_duplivert_sphere(point_cloud, material, scale)

select_probe_scene_object() # select probe scene object to show that loading is finished

