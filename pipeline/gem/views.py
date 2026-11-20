"""Exact 2D views with OpenCascade's hidden-line algorithm (HLRBRep)."""
from build123d import *
from OCP.HLRBRep import HLRBRep_Algo, HLRBRep_HLRToShape
from OCP.HLRAlgo import HLRAlgo_Projector
from OCP.gp import gp_Ax2, gp_Pnt, gp_Dir
from OCP.BRepLib import BRepLib

# view id -> (view direction towards the viewer, screen up)
VIEWS = {
    'front': ((0, 0, 1), (0, 1, 0)),      # face-up, table towards the viewer, head up
    'back': ((0, 0, -1), (0, 1, 0)),      # pavilion towards the viewer
    'top': ((0, 1, 0), (0, 0, 1)),        # from the head end, table up
    'bottom': ((0, -1, 0), (0, 0, 1)),    # from the point end, table up
    'left': ((-1, 0, 0), (0, 0, 1)),      # from the left side, table up
    'right': ((1, 0, 0), (0, 0, 1)),      # from the right side, table up
    'iso': ((0.5, -0.5, 0.7071), (0, 0, 1)),
}


def hlr(shape, view_dir, up):
    algo = HLRBRep_Algo(); algo.Add(shape.wrapped)
    algo.Projector(HLRAlgo_Projector(gp_Ax2(gp_Pnt(0, 0, 0), gp_Dir(*view_dir), gp_Dir(*up))))
    algo.Update(); algo.Hide()
    hs = HLRBRep_HLRToShape(algo)
    def comp(sh):
        if sh is None or sh.IsNull(): return Compound()
        BRepLib.BuildCurves3d_s(sh); return Compound(sh)
    return comp(hs.VCompound()), comp(hs.OutLineVCompound()), comp(hs.HCompound())


def export_svg(shape, view_id, path, hidden=False, line_weight=0.35, scale=10):
    view_dir, up = VIEWS[view_id]
    vis, vout, hid = hlr(shape, view_dir, up)
    exp = ExportSVG(scale=scale, line_weight=line_weight)
    exp.add_layer('visible', line_color=(0, 0, 0), line_weight=line_weight)
    exp.add_shape(vis, layer='visible')
    if len(vout.edges()): exp.add_shape(vout, layer='visible')
    if hidden and len(hid.edges()):
        exp.add_layer('hidden', line_color=(140, 140, 140), line_weight=line_weight * 0.6, line_type=LineType.DASHED)
        exp.add_shape(hid, layer='hidden')
    exp.write(path)
