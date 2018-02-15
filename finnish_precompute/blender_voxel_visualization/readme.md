To use the script in Blender, create a text block with the following startup code and press "Run Script":

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
