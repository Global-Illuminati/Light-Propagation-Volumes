
#include <stdio.h> // FILE

#define TINYOBJLOADER_IMPLEMENTATION
#include "tiny_obj_loader.h"

namespace Thekla {

struct Obj_Vertex {
    float position[3];
    int first_colocal;
};

struct Obj_UV {
	float uv[2];
};


struct Obj_Face {
    int vertex_index[3];
    int material_index;
};

struct Obj_Material {
    // @@ Read obj mtl parameters as is.
};

struct Obj_Mesh {
    int vertex_count;
    Obj_Vertex * vertex_array;

	int uv_count;
	Obj_UV *uv_array;

    int face_count;
    Obj_Face * face_array;

    int material_count;
    Obj_Material * material_array;
};

enum Load_Flags {
    Load_Flag_Weld_Attributes,
};

struct Obj_Load_Options {
    int load_flags;
};

Obj_Mesh * obj_mesh_load(const char * filename, const Obj_Load_Options * options);
void obj_mesh_free(Obj_Mesh * mesh);



Obj_Mesh * obj_mesh_load(const char * filename, const Obj_Load_Options * options) {

    using namespace std;
    vector<tinyobj::shape_t> shapes;
    vector<tinyobj::material_t> materials;
	tinyobj::attrib_t attr;
    string err;
    bool ret = tinyobj::LoadObj(&attr, &shapes, &materials, &err, filename);
    if (!ret) {
        printf("%s\n", err.c_str());
        return NULL;
    }

    printf("%lu shapes\n", shapes.size());
    printf("%lu materials\n", materials.size());

    assert(shapes.size() > 0);

    Obj_Mesh* mesh = new Obj_Mesh();


    mesh->vertex_count = attr.vertices.size() / 3;
    mesh->vertex_array = new Obj_Vertex[mesh->vertex_count];
	for (int nvert = 0; nvert < mesh->vertex_count; nvert++) {
		mesh->vertex_array[nvert].position[0] = attr.vertices[nvert*3+0];
		mesh->vertex_array[nvert].position[1] = attr.vertices[nvert*3+1];
		mesh->vertex_array[nvert].position[2] = attr.vertices[nvert*3+2];
		mesh->vertex_array[nvert].first_colocal = nvert;
	}
	mesh->vertex_count = attr.texcoords / 2;
	for (int nvert = 0; nvert < mesh->uv_count; nvert++) {
		mesh->uv_array[nvert].uv[0] = attr.texcoords[nvert * 2 + 0];
		mesh->uv_array[nvert].uv[1] = attr.texcoords[nvert * 2 + 1];
	}


	

    int num_faces = 0;
	for (int i = 0; i < shapes.size(); i++) {
		num_faces += shapes[i].mesh.indices.size();
	}
	mesh->face_count = num_faces/ 3;
	mesh->face_array = new Obj_Face[mesh->face_count];


	int tface = 0;
	for (int nshape = 0; nshape < shapes.size(); nshape++)
    for (int nface = 0; nface < shapes[nshape].mesh.indices.size()/3; nface++, tface++) {
        mesh->face_array[tface].material_index = nshape;
        mesh->face_array[tface].vertex_index[0] = shapes[nshape].mesh.indices[nface * 3].vertex_index;
        mesh->face_array[tface].vertex_index[1] = shapes[nshape].mesh.indices[nface * 3 + 1].vertex_index;
        mesh->face_array[tface].vertex_index[2] = shapes[nshape].mesh.indices[nface * 3 + 2].vertex_index;
    }
	mesh->face_count = tface;

    printf("Reading %d verts\n", mesh->vertex_count);
    printf("Reading %d triangles\n", mesh->face_count);

    mesh->material_count = 0;
    mesh->material_array = 0;

    return mesh;
}


void obj_mesh_free(Obj_Mesh * mesh) {
    if (mesh != NULL) {
        delete [] mesh->vertex_array;
        delete [] mesh->face_array;
        delete [] mesh->material_array;
        delete mesh;
    }
}

} // Thekla namespace
