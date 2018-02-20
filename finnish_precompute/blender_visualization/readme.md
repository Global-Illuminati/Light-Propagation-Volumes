To use the scripts in Blender, create a text block with either of the following startup codes and press "Run Script":

## Voxel visualization

```python
# Settings
voxels_filename =    "..\\voxels.dat"
center_voxel_scene = True
automatic_scale =    True
points_only =        False          # Enable for better performance


import bpy
import sys
script_filename = "voxel_visualization.py"
path = bpy.path.abspath("//" + script_filename)
voxels_path = bpy.path.abspath("//" + voxels_filename)
sys.argv = [script_filename, voxels_path, center_voxel_scene, automatic_scale, points_only]
exec(compile(open(path).read(), path, 'exec'))
```

## Probe visualization

```python
# Settings
probes_filename =    "..\\probes.dat"
center_probes_scene = False
automatic_scale =    False
points_only =        False          # Enable for better performance


import bpy
import sys
script_filename = "probe_visualization.py"
path = bpy.path.abspath("//" + script_filename)
probes_path = bpy.path.abspath("//" + probes_filename)
sys.argv = [script_filename, probes_path, center_probes_scene, automatic_scale, points_only]
exec(compile(open(path).read(), path, 'exec'))
```